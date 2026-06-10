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
from app.models import User, Profile, MatchingProfile, Founder, Ambassador, Referral
from app.auth import get_password_hash, get_current_active_user, create_access_token
from sqlalchemy import text

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
    ref: Optional[str] = None


class CreateIdentitySessionRequest(BaseModel):
    pass  # No additional fields needed, uses current user


class SubmitIdentityInfoRequest(BaseModel):
    real_name: str
    birthdate: str  # YYYY-MM-DD
    document_type: str  # drivers_license, my_number_card, passport


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
    """Check if user has paid member access (subscription active OR legacy paid OR founder free)."""
    return user.is_legacy_paid or user.subscription_status == "active" or user.subscription_exempt


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


FOUNDER_FREE_LIMIT = int(os.getenv("FOUNDER_FREE_LIMIT", "200"))


@router.post("/register-only")
async def register_only(
    request: CreateCheckoutSessionRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new user and send email verification.
    Supports founder referral codes via `ref` field.
    Flow: Register -> Email Verify -> KYC -> Payment (normal)
    Flow: Register -> Email Verify -> KYC -> Profile (founder free, skip payment)
    """
    existing_user = db.query(User).filter(User.email == request.email).first()
    
    # Prevent repeated registration attempts with unverified email within 1 hour
    if existing_user and not existing_user.email_verified:
        if existing_user.email_verification_expires and existing_user.email_verification_expires > datetime.utcnow():
            # If verification email was sent recently, don't allow re-registration
            time_since_last_email = datetime.utcnow() - (existing_user.email_verification_expires - timedelta(hours=24))
            if time_since_last_email < timedelta(hours=1):
                raise HTTPException(
                    status_code=429, 
                    detail="認証メールを既に送信しました。1時間後に再度お試しください。"
                )

    if request.phone_number:
        existing_phone = db.query(User).filter(User.phone_number == request.phone_number).first()
        if existing_phone and (not existing_user or existing_phone.id != existing_user.id):
            raise HTTPException(status_code=400, detail="この携帯番号は既に使用されています")

    # Check if ref code is a valid active founder or ambassador code
    founder_free = False
    founder_code_val = None
    ambassador_code_val = None
    ref_code = request.ref if request.ref else None

    if ref_code:
        try:
            founder = db.query(Founder).filter(
                Founder.founder_code == ref_code,
                Founder.is_active == True,
            ).first()
            if founder:
                # Use raw SQL to avoid ORM column-mapping issues on production DB.
                # First try with deleted_at filter, fall back without it.
                try:
                    total_result = db.execute(
                        text(
                            "SELECT COUNT(*) FROM users "
                            "WHERE is_founder_free_member = TRUE "
                            "AND deleted_at IS NULL"
                        )
                    ).scalar()
                except Exception:
                    db.rollback()
                    total_result = db.execute(
                        text(
                            "SELECT COUNT(*) FROM users "
                            "WHERE is_founder_free_member = TRUE"
                        )
                    ).scalar()
                total = total_result or 0
                if total < FOUNDER_FREE_LIMIT:
                    founder_free = True
                    founder_code_val = founder.founder_code
            else:
                # Check ambassador codes (paid referral)
                ambassador = db.query(Ambassador).filter(
                    Ambassador.ambassador_code == ref_code,
                    Ambassador.is_active == True,
                ).first()
                if ambassador:
                    ambassador_code_val = ambassador.ambassador_code
        except Exception as e:
            logger.error(f"Ref code check failed (ref={ref_code}): {e}")
            db.rollback()
            founder_free = False
            founder_code_val = None
            ambassador_code_val = None

    # Resolve membership_type: try 'founder_free' first, fall back to 'premium'
    # if the DB CHECK constraint hasn't been updated yet.
    membership_type_val = "founder_free" if founder_free else "premium"

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
        existing_user.is_active = True
        existing_user.email_verified = False
        existing_user.kyc_status = "UNVERIFIED"
        existing_user.is_verified = False
        existing_user.stripe_identity_verification_session_id = None
        existing_user.account_status = "pending_email"
        existing_user.card_required = not founder_free
        existing_user.card_registered = False
        existing_user.identity_retry_count = 0
        if founder_free:
            existing_user.membership_type = "founder_free"
            existing_user.is_founder_free_member = True
            existing_user.subscription_exempt = True
            existing_user.referred_by_founder_code = founder_code_val
            existing_user.ref_code_used = founder_code_val
            referral = Referral(
                user_id=existing_user.id,
                ref_code=founder_code_val,
                founder_code=founder_code_val,
                status="registered",
            )
            db.add(referral)
        elif ambassador_code_val:
            existing_user.referred_by_ambassador_code = ambassador_code_val
            existing_user.ref_code_used = ambassador_code_val
            referral = Referral(
                user_id=existing_user.id,
                ref_code=ambassador_code_val,
                ambassador_code=ambassador_code_val,
                status="registered",
            )
            db.add(referral)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Commit failed for existing user update: {e}")
            if founder_free and "membership_type" in str(e):
                logger.info("Retrying with membership_type='premium' due to DB constraint")
                # Re-apply all fields after rollback (ORM state is expired)
                existing_user.display_name = request.display_name
                existing_user.password_hash = get_password_hash(request.password)
                if request.phone_number is not None:
                    existing_user.phone_number = request.phone_number or None
                existing_user.preferred_lang = request.preferred_lang
                existing_user.residence_country = request.residence_country
                existing_user.terms_accepted_at = datetime.utcnow()
                existing_user.terms_version = "1.0"
                existing_user.is_active = True
                existing_user.email_verified = False
                existing_user.kyc_status = "UNVERIFIED"
                existing_user.is_verified = False
                existing_user.stripe_identity_verification_session_id = None
                # Downgrade to premium: reset all founder fields
                existing_user.membership_type = "premium"
                existing_user.is_founder_free_member = False
                existing_user.subscription_exempt = False
                existing_user.referred_by_founder_code = None
                existing_user.ref_code_used = None
                founder_free = False
                founder_code_val = None
                db.commit()
            else:
                raise
        user = existing_user
    else:
        def _create_new_user(mtype: str, is_ff: bool, ff_code: str | None, amb_code: str | None) -> User:
            return User(
                email=request.email,
                password_hash=get_password_hash(request.password),
                display_name=request.display_name,
                phone_number=request.phone_number or None,
                membership_type=mtype,
                is_active=True,
                preferred_lang=request.preferred_lang,
                residence_country=request.residence_country,
                terms_accepted_at=datetime.utcnow(),
                terms_version="1.0",
                kyc_status="UNVERIFIED",
                email_verified=False,
                is_founder_free_member=is_ff,
                subscription_exempt=is_ff,
                referred_by_founder_code=ff_code,
                referred_by_ambassador_code=amb_code,
                ref_code_used=ff_code or amb_code,
                account_status="pending_email",
                card_required=not is_ff,
                card_registered=False,
            )

        user = _create_new_user(membership_type_val, founder_free, founder_code_val, ambassador_code_val)
        db.add(user)
        try:
            db.flush()
        except Exception as e:
            db.rollback()
            logger.error(f"Flush failed for new user: {e}")
            if founder_free and "membership_type" in str(e):
                logger.info("Retrying with membership_type='premium' due to DB constraint")
                membership_type_val = "premium"
                founder_free = False
                founder_code_val = None
                user = _create_new_user("premium", False, None, ambassador_code_val)
                db.add(user)
                db.flush()
            else:
                raise

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

        # Create referral record if founder or ambassador code was used
        if founder_code_val:
            referral = Referral(
                user_id=user.id,
                ref_code=founder_code_val,
                founder_code=founder_code_val,
                status="registered",
            )
            db.add(referral)
        elif ambassador_code_val:
            referral = Referral(
                user_id=user.id,
                ref_code=ambassador_code_val,
                ambassador_code=ambassador_code_val,
                status="registered",
            )
            db.add(referral)

        db.commit()
        db.refresh(user)

    # Only create Stripe customer for non-founder-free members
    if not founder_free:
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
            detail="INVALID_TOKEN"
        )

    # Token hash found but email already verified (re-click of verification link).
    # Allow re-click within 1-hour window so user can continue to KYC.
    if user.email_verified:
        # Check re-click window (email_verification_expires repurposed as re-click deadline)
        if user.email_verification_expires:
            expires_naive = user.email_verification_expires.replace(tzinfo=None) if user.email_verification_expires.tzinfo else user.email_verification_expires
            if expires_naive < datetime.utcnow():
                # Window expired — clear token hash to prevent further use
                user.email_verification_token_hash = None
                user.email_verification_expires = None
                db.commit()
                return {
                    "status": "already_verified",
                    "message": "このメールアドレスは既に確認済みです。ログインしてください。",
                }
        else:
            # No expiry set (legacy data) — clear token hash, require login
            user.email_verification_token_hash = None
            db.commit()
            return {
                "status": "already_verified",
                "message": "このメールアドレスは既に確認済みです。ログインしてください。",
            }

        # Within re-click window — issue token so user can continue to KYC
        access_token = create_access_token(
            data={"sub": user.email},
            expires_delta=timedelta(days=7)
        )
        return {
            "status": "already_verified",
            "message": "このメールアドレスは既に確認済みです。",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "is_founder_free_member": bool(user.is_founder_free_member),
                "subscription_exempt": bool(user.subscription_exempt),
            }
        }

    if user.email_verification_expires:
        expires_naive = user.email_verification_expires.replace(tzinfo=None) if user.email_verification_expires.tzinfo else user.email_verification_expires
        if expires_naive < datetime.utcnow():
            raise HTTPException(status_code=400, detail="トークンの有効期限が切れています。再送信してください。")

    user.email_verified = True
    user.account_status = "email_verified"
    # Keep email_verification_token_hash so re-clicks can still find the user.
    # Set a 1-hour re-click window for KYC continuation.
    user.email_verification_expires = datetime.utcnow() + timedelta(hours=1)
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
            "display_name": user.display_name,
            "is_founder_free_member": bool(user.is_founder_free_member),
            "subscription_exempt": bool(user.subscription_exempt),
            "account_status": user.account_status,
            "card_required": bool(getattr(user, 'card_required', True)),
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
    Founder free members skip payment and are activated directly.
    """
    if not is_user_kyc_verified(current_user):
        raise HTTPException(status_code=403, detail="KYC verification required before payment")
    
    # Founder free members skip payment - activate directly after KYC
    if current_user.is_founder_free_member or current_user.subscription_exempt:
        if current_user.subscription_status != "active":
            current_user.subscription_status = "active"
            current_user.is_active = True
            current_user.account_status = "active"
            db.commit()
            db.refresh(current_user)
        
        # Return success without Stripe checkout
        return {
            "status": "activated",
            "message": "Founder free member activated",
            "skip_payment": True
        }
    
    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if current_user.subscription_status == "active":
        raise HTTPException(status_code=400, detail="User already has an active subscription")

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


@router.post("/submit-identity-info")
async def submit_identity_info(
    request: SubmitIdentityInfoRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Submit real name and birthdate for identity verification, then create Stripe Identity session."""
    import re
    from datetime import date as date_type

    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if current_user.kyc_status == "VERIFIED":
        raise HTTPException(status_code=400, detail="Identity already verified")

    if getattr(current_user, 'identity_retry_count', 0) >= 3:
        raise HTTPException(status_code=400, detail="IDENTITY_MAX_RETRIES")

    if request.document_type not in ("drivers_license", "my_number_card", "passport"):
        raise HTTPException(status_code=400, detail="Invalid document type")

    try:
        bd = date_type.fromisoformat(request.birthdate)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid birthdate format. Use YYYY-MM-DD")

    current_user.real_name_kanji = request.real_name.strip()
    current_user.birthdate = bd
    current_user.identity_document_type = request.document_type
    current_user.account_status = "identity_pending"
    db.commit()

    try:
        verification_session = stripe.identity.VerificationSession.create(
            type="document",
            metadata={
                "user_id": str(current_user.id),
                "document_type": request.document_type,
            },
            options={
                "document": {
                    "require_matching_selfie": False
                }
            }
        )

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


@router.post("/create-identity-session")
async def create_identity_session(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Identity verification session for KYC (legacy endpoint)."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if current_user.kyc_status == "VERIFIED":
        raise HTTPException(status_code=400, detail="Identity already verified")

    try:
        verification_session = stripe.identity.VerificationSession.create(
            type="document",
            metadata={
                "user_id": str(current_user.id)
            },
            options={
                "document": {
                    "require_matching_selfie": False
                }
            }
        )

        current_user.stripe_identity_verification_session_id = verification_session.id
        current_user.kyc_status = "PENDING"
        current_user.account_status = "identity_pending"
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


def _normalize_name(name: str) -> str:
    """Normalize a name for comparison: strip, lowercase, remove spaces, convert kana."""
    import unicodedata
    if not name:
        return ""
    n = unicodedata.normalize("NFKC", name)
    n = n.strip().lower()
    n = n.replace(" ", "").replace("\u3000", "")
    # Convert katakana to hiragana for comparison
    result = []
    for ch in n:
        cp = ord(ch)
        if 0x30A1 <= cp <= 0x30F6:
            result.append(chr(cp - 0x60))
        else:
            result.append(ch)
    return "".join(result)


def _names_match(input_name: str, doc_name: str) -> bool:
    """Check if user-input name matches document name (with fuzzy normalization)."""
    if not input_name or not doc_name:
        return False
    return _normalize_name(input_name) == _normalize_name(doc_name)


def _dates_match(input_date, doc_date) -> bool:
    """Check if dates match."""
    from datetime import date as date_type
    if not input_date or not doc_date:
        return False
    if isinstance(input_date, str):
        input_date = date_type.fromisoformat(input_date)
    if isinstance(doc_date, str):
        doc_date = date_type.fromisoformat(doc_date)
    return input_date == doc_date


def _verify_identity_match(user: User, vs) -> dict:
    """Compare user-input identity info with Stripe Identity document data."""
    from datetime import date as date_type

    doc_name = None
    doc_dob = None

    try:
        if hasattr(vs, 'last_verification_report') and vs.last_verification_report:
            report = stripe.identity.VerificationReport.retrieve(vs.last_verification_report)
            if hasattr(report, 'document') and report.document:
                doc = report.document
                first = getattr(doc, 'first_name', '') or ''
                last = getattr(doc, 'last_name', '') or ''
                doc_name = f"{last}{first}".strip() or f"{first}{last}".strip()
                if not doc_name:
                    doc_name = None
                dob = getattr(doc, 'dob', None)
                if dob:
                    doc_dob = date_type(year=dob.get('year', 0), month=dob.get('month', 0), day=dob.get('day', 0))
    except Exception as e:
        logger.error(f"Failed to retrieve verification report: {e}")
        return {"match": False, "reason": "report_error", "doc_name": None, "doc_dob": None}

    name_ok = _names_match(user.real_name_kanji or "", doc_name or "")
    date_ok = _dates_match(user.birthdate, doc_dob)

    return {
        "match": name_ok and date_ok,
        "name_match": name_ok,
        "date_match": date_ok,
        "doc_name": doc_name,
        "doc_dob": str(doc_dob) if doc_dob else None,
    }


@router.get("/kyc-status")
async def get_kyc_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Poll KYC verification status with name/birthdate matching."""
    session_id = current_user.stripe_identity_verification_session_id

    if current_user.kyc_status == "VERIFIED" or current_user.is_legacy_paid:
        account_status = getattr(current_user, 'account_status', 'active')
        return {"kyc_status": "VERIFIED", "can_proceed_to_payment": True, "account_status": account_status}

    if session_id and STRIPE_SECRET_KEY:
        try:
            vs = stripe.identity.VerificationSession.retrieve(session_id)
            if vs.status == "verified" and current_user.kyc_status != "VERIFIED":
                # Document verified by Stripe — now check name/birthdate match
                match_result = _verify_identity_match(current_user, vs)

                if match_result["match"]:
                    current_user.kyc_status = "VERIFIED"
                    current_user.is_verified = True
                    current_user.verified_name = match_result.get("doc_name")
                    current_user.verified_birthdate = match_result.get("doc_dob")
                    current_user.identity_verified_at = datetime.utcnow()
                    current_user.identity_verification_method = "stripe_identity"

                    # Determine next status based on card_required
                    if getattr(current_user, 'card_required', True) and not getattr(current_user, 'card_registered', False):
                        current_user.account_status = "card_pending"
                    else:
                        current_user.account_status = "active"
                    db.commit()
                    return {
                        "kyc_status": "VERIFIED",
                        "can_proceed_to_payment": True,
                        "account_status": current_user.account_status,
                        "identity_match": True,
                    }
                else:
                    # Name/birthdate mismatch
                    retry_count = getattr(current_user, 'identity_retry_count', 0) + 1
                    current_user.identity_retry_count = retry_count
                    current_user.kyc_status = "UNVERIFIED"
                    current_user.stripe_identity_verification_session_id = None

                    if retry_count >= 3:
                        current_user.account_status = "identity_review"
                    else:
                        current_user.account_status = "identity_rejected"
                    db.commit()
                    return {
                        "kyc_status": "MISMATCH",
                        "can_proceed_to_payment": False,
                        "account_status": current_user.account_status,
                        "identity_match": False,
                        "name_match": match_result.get("name_match"),
                        "date_match": match_result.get("date_match"),
                        "retry_count": retry_count,
                        "max_retries": 3,
                    }

            return {
                "kyc_status": current_user.kyc_status,
                "stripe_status": vs.status,
                "can_proceed_to_payment": False,
                "account_status": getattr(current_user, 'account_status', 'identity_pending'),
            }
        except stripe.error.StripeError as e:
            logger.error(f"Failed to check verification session: {e}")

    return {
        "kyc_status": current_user.kyc_status,
        "can_proceed_to_payment": False,
        "account_status": getattr(current_user, 'account_status', 'pending_email'),
    }


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
        if user.membership_type != "founder_free":
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
            if user.membership_type != "founder_free":
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
            if not user.is_legacy_paid and not user.subscription_exempt:
                user.is_active = False
        db.commit()
        logger.info(f"Subscription updated for user {user.id}: {status}")


async def handle_subscription_deleted(data: dict, db: Session):
    """Handle customer.subscription.deleted event."""
    customer_id = data.get("customer")
    
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.subscription_status = "canceled"
        # Don't deactivate legacy paid or founder_free users
        if not user.is_legacy_paid and not user.subscription_exempt:
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
    
    if user and user.kyc_status != "VERIFIED":
        user.kyc_status = "VERIFIED"
        user.is_verified = True
        db.commit()
        logger.info(f"Identity verified via webhook for user {user.id}, pending name/birthdate match")


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
