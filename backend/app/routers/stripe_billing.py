"""
Stripe Billing Router - Handles subscription checkout, webhooks, and Identity (KYC) verification.
"""

import os
import stripe
import logging
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models import User, Profile, MatchingProfile
from app.auth import get_password_hash, get_current_active_user, create_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stripe", tags=["stripe"])

# Stripe configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


# ============ Pydantic Models ============

class CreateCheckoutSessionRequest(BaseModel):
    email: EmailStr
    display_name: str
    password: str
    phone_number: Optional[str] = None
    preferred_lang: str = "ja"
    residence_country: str = "JP"
    terms_accepted: bool = True


class CreateIdentitySessionRequest(BaseModel):
    pass  # No additional fields needed, uses current user


class CreatePortalSessionRequest(BaseModel):
    return_url: Optional[str] = None


class EmailVerificationRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


# ============ Helper Functions ============

def get_or_create_stripe_customer(db: Session, user: User) -> str:
    """Get existing Stripe customer or create a new one."""
    if user.stripe_customer_id:
        return user.stripe_customer_id
    
    customer = stripe.Customer.create(
        email=user.email,
        name=user.display_name,
        metadata={"user_id": str(user.id)}
    )
    
    user.stripe_customer_id = customer.id
    db.commit()
    
    return customer.id


def is_user_paid_member(user: User) -> bool:
    """Check if user has paid member access (subscription active OR legacy paid)."""
    return user.is_legacy_paid or user.subscription_status == "active"


def is_user_kyc_verified(user: User) -> bool:
    """Check if user has completed KYC (verified OR legacy paid)."""
    return user.is_legacy_paid or user.kyc_status == "VERIFIED"


def can_user_perform_action(user: User) -> bool:
    """Check if user can perform restricted actions (post, comment, chat, etc.)."""
    return is_user_paid_member(user) and is_user_kyc_verified(user)


# ============ API Endpoints ============

@router.get("/config")
async def get_stripe_config():
    """Get Stripe publishable key for frontend."""
    return {
        "publishable_key": STRIPE_PUBLISHABLE_KEY,
        "price_id": STRIPE_PRICE_ID
    }


def _send_verification_email(to_email: str, display_name: str, token: str) -> None:
    """Send email verification link."""
    from app.routers.auth import _send_email
    frontend_url = FRONTEND_URL
    verify_url = f"{frontend_url}/verify-email?token={token}"
    subject = "【Carat】メールアドレスの確認"
    body = f"""{display_name} 様\n\nCaratへのご登録ありがとうございます。\n以下のリンクをクリックしてメールアドレスを確認してください（有効期限: 24時間）。\n\n{verify_url}\n\nこのメールに心当たりがない場合は、このメールを破棄してください。\n"""
    _send_email(to_email, subject, body)


@router.post("/register-only")
async def register_only(
    request: CreateCheckoutSessionRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new user and send email verification.
    Flow: Register -> Email Verify -> KYC -> Payment.
    """
    existing_user = db.query(User).filter(User.email == request.email).first()

    if request.phone_number:
        existing_phone = db.query(User).filter(User.phone_number == request.phone_number).first()
        if existing_phone and (not existing_user or existing_phone.id != existing_user.id):
            raise HTTPException(status_code=400, detail="この携帯番号は既に使用されています")

    if existing_user:
        if existing_user.subscription_status == "active":
            raise HTTPException(status_code=400, detail="User already has an active subscription")
        existing_user.display_name = request.display_name
        existing_user.password_hash = get_password_hash(request.password)
        if request.phone_number is not None:
            existing_user.phone_number = request.phone_number or None
        existing_user.preferred_lang = request.preferred_lang
        existing_user.residence_country = request.residence_country
        existing_user.terms_accepted_at = datetime.utcnow()
        existing_user.terms_version = "1.0"
        db.commit()
        user = existing_user
    else:
        user = User(
            email=request.email,
            password_hash=get_password_hash(request.password),
            display_name=request.display_name,
            phone_number=request.phone_number or None,
            membership_type="premium",
            is_active=True,
            preferred_lang=request.preferred_lang,
            residence_country=request.residence_country,
            terms_accepted_at=datetime.utcnow(),
            terms_version="1.0",
            kyc_status="UNVERIFIED",
            email_verified=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        profile = Profile(
            user_id=user.id,
            handle=f"user_{user.id}"
        )
        db.add(profile)

        matching_profile = MatchingProfile(
            user_id=user.id,
            nickname=request.display_name,
            display_flag=True,
            prefecture="未設定"
        )
        db.add(matching_profile)
        db.commit()

    get_or_create_stripe_customer(db, user)

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    user.email_verification_token_hash = token_hash
    user.email_verification_expires = datetime.utcnow() + timedelta(hours=24)
    user.email_verified = False
    db.commit()

    try:
        _send_verification_email(user.email, user.display_name, token)
    except Exception as e:
        logger.error(f"Verification email send failed: {e}")

    return {
        "status": "email_verification_required",
        "email": user.email,
        "message": "確認メールを送信しました。メール内のリンクをクリックしてください。"
    }


@router.post("/verify-email")
async def verify_email(
    request: EmailVerificationRequest,
    db: Session = Depends(get_db)
):
    """Verify email address using token from verification email."""
    token_hash = hashlib.sha256(request.token.encode("utf-8")).hexdigest()
    user = db.query(User).filter(User.email_verification_token_hash == token_hash).first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="無効なトークンです。既にメール認証が完了している場合は、ログインページからログインしてください。"
        )

    if user.email_verified:
        return {
            "status": "already_verified",
            "message": "このメールアドレスは既に確認済みです。",
            "user": {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name
            }
        }

    if user.email_verification_expires:
        expires_naive = user.email_verification_expires.replace(tzinfo=None) if user.email_verification_expires.tzinfo else user.email_verification_expires
        if expires_naive < datetime.utcnow():
            raise HTTPException(status_code=400, detail="トークンの有効期限が切れています。再送信してください。")

    user.email_verified = True
    user.email_verification_expires = None
    db.commit()

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(days=7)
    )

    return {
        "status": "verified",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name
        }
    }


@router.post("/resend-verification")
async def resend_verification(
    request: ResendVerificationRequest,
    db: Session = Depends(get_db)
):
    """Resend email verification. Always returns success to avoid enumeration."""
    user = db.query(User).filter(User.email == request.email).first()

    if not user or user.email_verified:
        return {"status": "ok"}

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    user.email_verification_token_hash = token_hash
    user.email_verification_expires = datetime.utcnow() + timedelta(hours=24)
    db.commit()

    try:
        _send_verification_email(user.email, user.display_name, token)
    except Exception as e:
        logger.error(f"Resend verification email failed: {e}")

    return {"status": "ok"}


@router.post("/create-checkout-session")
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    db: Session = Depends(get_db)
):
    """
    Create a Stripe Checkout session for subscription.
    Also creates or updates the user account.
    """
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    existing_user = db.query(User).filter(User.email == request.email).first()

    if request.phone_number:
        existing_phone = db.query(User).filter(User.phone_number == request.phone_number).first()
        if existing_phone and (not existing_user or existing_phone.id != existing_user.id):
            raise HTTPException(status_code=400, detail="この携帯番号は既に使用されています")

    if existing_user:
        if existing_user.subscription_status == "active":
            raise HTTPException(status_code=400, detail="User already has an active subscription")
        existing_user.display_name = request.display_name
        existing_user.password_hash = get_password_hash(request.password)
        if request.phone_number is not None:
            existing_user.phone_number = request.phone_number or None
        existing_user.preferred_lang = request.preferred_lang
        existing_user.residence_country = request.residence_country
        existing_user.terms_accepted_at = datetime.utcnow()
        existing_user.terms_version = "1.0"
        db.commit()
        customer_id = get_or_create_stripe_customer(db, existing_user)
        user_id = existing_user.id
    else:
        new_user = User(
            email=request.email,
            password_hash=get_password_hash(request.password),
            display_name=request.display_name,
            phone_number=request.phone_number or None,
            membership_type="premium",
            is_active=True,
            preferred_lang=request.preferred_lang,
            residence_country=request.residence_country,
            terms_accepted_at=datetime.utcnow(),
            terms_version="1.0",
            kyc_status="UNVERIFIED"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        profile = Profile(
            user_id=new_user.id,
            handle=f"user_{new_user.id}"
        )
        db.add(profile)

        matching_profile = MatchingProfile(
            user_id=new_user.id,
            nickname=request.display_name,
            display_flag=True,
            prefecture="未設定"
        )
        db.add(matching_profile)
        db.commit()

        customer_id = get_or_create_stripe_customer(db, new_user)
        user_id = new_user.id

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price": STRIPE_PRICE_ID,
                "quantity": 1
            }],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/subscribe/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/subscribe?canceled=true",
            metadata={
                "user_id": str(user_id)
            },
            subscription_data={
                "metadata": {
                    "user_id": str(user_id)
                }
            }
        )

        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/start-checkout")
async def start_checkout(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Start a Stripe Checkout session for an already-registered and authenticated user.
    Used after KYC verification in the registration flow.
    """
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if current_user.subscription_status == "active":
        raise HTTPException(status_code=400, detail="User already has an active subscription")

    if not is_user_kyc_verified(current_user):
        raise HTTPException(status_code=403, detail="KYC verification required before payment")

    customer_id = get_or_create_stripe_customer(db, current_user)

    try:
        locale = current_user.preferred_lang or "ja"
        if locale not in ("ja", "en"):
            locale = "ja"

        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price": STRIPE_PRICE_ID,
                "quantity": 1
            }],
            mode="subscription",
            locale=locale,
            success_url=f"{FRONTEND_URL}/subscribe/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/subscribe?canceled=true",
            metadata={
                "user_id": str(current_user.id)
            },
            subscription_data={
                "metadata": {
                    "user_id": str(current_user.id)
                }
            }
        )

        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/checkout-session/{session_id}")
async def get_checkout_session(session_id: str, db: Session = Depends(get_db)):
    """Get checkout session status and user info after successful payment.
    Only issues access token if user has completed KYC verification."""
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status == "paid":
            user = db.query(User).filter(
                User.stripe_customer_id == session.customer
            ).first()
            
            if user:
                if not is_user_kyc_verified(user):
                    return {
                        "status": "kyc_required",
                        "payment_status": session.payment_status,
                        "message": "KYC verification required before login"
                    }

                access_token = create_access_token(
                    data={"sub": user.email},
                    expires_delta=timedelta(days=7)
                )
                
                return {
                    "status": "success",
                    "payment_status": session.payment_status,
                    "subscription_status": user.subscription_status,
                    "access_token": access_token,
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "display_name": user.display_name
                    }
                }
        
        return {
            "status": "pending",
            "payment_status": session.payment_status
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-identity-session")
async def create_identity_session(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Identity verification session for KYC."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Check if already verified
    if current_user.kyc_status == "VERIFIED":
        raise HTTPException(status_code=400, detail="Identity already verified")
    
    try:
        # Create Identity verification session
        verification_session = stripe.identity.VerificationSession.create(
            type="document",
            metadata={
                "user_id": str(current_user.id)
            },
            options={
                "document": {
                    "require_matching_selfie": True
                }
            }
        )
        
        # Update user with session ID
        current_user.stripe_identity_verification_session_id = verification_session.id
        current_user.kyc_status = "PENDING"
        db.commit()
        
        return {
            "client_secret": verification_session.client_secret,
            "session_id": verification_session.id
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe Identity error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-portal-session")
async def create_portal_session(
    request: CreatePortalSessionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Customer Portal session for managing subscription."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found")
    
    try:
        return_url = request.return_url or f"{FRONTEND_URL}/account"
        
        portal_session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=return_url
        )
        
        return {"portal_url": portal_session.url}
    except stripe.error.StripeError as e:
        logger.error(f"Stripe Portal error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subscription-status")
async def get_subscription_status(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's subscription and KYC status."""
    return {
        "subscription_status": current_user.subscription_status,
        "kyc_status": current_user.kyc_status,
        "is_legacy_paid": current_user.is_legacy_paid,
        "is_paid_member": is_user_paid_member(current_user),
        "is_kyc_verified": is_user_kyc_verified(current_user),
        "can_perform_actions": can_user_perform_action(current_user),
        "stripe_customer_id": current_user.stripe_customer_id
    }


@router.get("/kyc-status")
async def get_kyc_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Poll KYC verification status. Used by frontend to check if webhook has confirmed KYC."""
    session_id = current_user.stripe_identity_verification_session_id

    if current_user.kyc_status == "VERIFIED" or current_user.is_legacy_paid:
        return {"kyc_status": "VERIFIED", "can_proceed_to_payment": True}

    if session_id and STRIPE_SECRET_KEY:
        try:
            vs = stripe.identity.VerificationSession.retrieve(session_id)
            if vs.status == "verified" and current_user.kyc_status != "VERIFIED":
                current_user.kyc_status = "VERIFIED"
                current_user.is_verified = True
                db.commit()
                return {"kyc_status": "VERIFIED", "can_proceed_to_payment": True}
            return {"kyc_status": current_user.kyc_status, "stripe_status": vs.status, "can_proceed_to_payment": False}
        except stripe.error.StripeError as e:
            logger.error(f"Failed to check verification session: {e}")

    return {"kyc_status": current_user.kyc_status, "can_proceed_to_payment": False}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    db: Session = Depends(get_db)
):
    """Handle Stripe webhooks for subscription and identity events."""
    if not STRIPE_WEBHOOK_SECRET:
        logger.warning("Stripe webhook secret not configured")
        raise HTTPException(status_code=500, detail="Webhook not configured")
    
    payload = await request.body()
    
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    event_type = event["type"]
    data = event["data"]["object"]
    
    logger.info(f"Received Stripe webhook: {event_type}")
    
    # Handle subscription events
    if event_type == "checkout.session.completed":
        await handle_checkout_completed(data, db)
    
    elif event_type == "customer.subscription.created":
        await handle_subscription_created(data, db)
    
    elif event_type == "customer.subscription.updated":
        await handle_subscription_updated(data, db)
    
    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(data, db)
    
    elif event_type == "invoice.payment_succeeded":
        await handle_invoice_payment_succeeded(data, db)
    
    elif event_type == "invoice.payment_failed":
        await handle_invoice_payment_failed(data, db)
    
    # Handle Identity events
    elif event_type == "identity.verification_session.verified":
        await handle_identity_verified(data, db)
    
    elif event_type == "identity.verification_session.requires_input":
        await handle_identity_requires_input(data, db)
    
    elif event_type == "identity.verification_session.canceled":
        await handle_identity_canceled(data, db)
    
    return {"status": "success"}


# ============ Webhook Handlers ============

async def handle_checkout_completed(data: dict, db: Session):
    """Handle checkout.session.completed event."""
    customer_id = data.get("customer")
    subscription_id = data.get("subscription")
    
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.stripe_subscription_id = subscription_id
        user.subscription_status = "active"
        user.is_active = True
        user.membership_type = "premium"
        db.commit()
        logger.info(f"Checkout completed for user {user.id}")


async def handle_subscription_created(data: dict, db: Session):
    """Handle customer.subscription.created event."""
    customer_id = data.get("customer")
    subscription_id = data.get("id")
    status = data.get("status")
    
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.stripe_subscription_id = subscription_id
        user.subscription_status = status
        if status == "active":
            user.is_active = True
            user.membership_type = "premium"
        db.commit()
        logger.info(f"Subscription created for user {user.id}: {status}")


async def handle_subscription_updated(data: dict, db: Session):
    """Handle customer.subscription.updated event."""
    customer_id = data.get("customer")
    status = data.get("status")
    
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.subscription_status = status
        if status == "active":
            user.is_active = True
        elif status in ["canceled", "unpaid"]:
            user.is_active = False
        db.commit()
        logger.info(f"Subscription updated for user {user.id}: {status}")


async def handle_subscription_deleted(data: dict, db: Session):
    """Handle customer.subscription.deleted event."""
    customer_id = data.get("customer")
    
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.subscription_status = "canceled"
        # Don't deactivate legacy paid users
        if not user.is_legacy_paid:
            user.is_active = False
        db.commit()
        logger.info(f"Subscription deleted for user {user.id}")


async def handle_invoice_payment_succeeded(data: dict, db: Session):
    """Handle invoice.payment_succeeded event."""
    customer_id = data.get("customer")
    
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.subscription_status = "active"
        user.is_active = True
        db.commit()
        logger.info(f"Invoice payment succeeded for user {user.id}")


async def handle_invoice_payment_failed(data: dict, db: Session):
    """Handle invoice.payment_failed event."""
    customer_id = data.get("customer")
    
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.subscription_status = "past_due"
        db.commit()
        logger.info(f"Invoice payment failed for user {user.id}")


async def handle_identity_verified(data: dict, db: Session):
    """Handle identity.verification_session.verified event."""
    session_id = data.get("id")
    
    user = db.query(User).filter(
        User.stripe_identity_verification_session_id == session_id
    ).first()
    
    if user:
        user.kyc_status = "VERIFIED"
        user.is_verified = True
        db.commit()
        logger.info(f"Identity verified for user {user.id}")


async def handle_identity_requires_input(data: dict, db: Session):
    """Handle identity.verification_session.requires_input event."""
    session_id = data.get("id")
    
    user = db.query(User).filter(
        User.stripe_identity_verification_session_id == session_id
    ).first()
    
    if user:
        user.kyc_status = "REJECTED"
        db.commit()
        logger.info(f"Identity requires input for user {user.id}")


async def handle_identity_canceled(data: dict, db: Session):
    """Handle identity.verification_session.canceled event."""
    session_id = data.get("id")
    
    user = db.query(User).filter(
        User.stripe_identity_verification_session_id == session_id
    ).first()
    
    if user:
        user.kyc_status = "UNVERIFIED"
        user.stripe_identity_verification_session_id = None
        db.commit()
        logger.info(f"Identity canceled for user {user.id}")
