from datetime import timedelta, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.models import User, Profile, MatchingProfile
from app.schemas import UserCreate, User as UserSchema, Token, PhoneVerificationRequest, PhoneVerificationConfirm, UserRegistrationStep1
from app.auth import authenticate_user, create_access_token, get_password_hash, get_current_active_user, get_current_admin_user, ACCESS_TOKEN_EXPIRE_MINUTES
from app.sms_service import sms_service
import random
import os
import logging
import hashlib
import secrets
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

PHONE_AUTH_ENABLED = os.getenv("PHONE_AUTH_ENABLED", "false").lower() == "true"


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


SMTP_TIMEOUT = 15


def _send_email_sync(to_email: str, subject: str, body: str) -> None:
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")

    if not smtp_user or not smtp_password:
        logger.info(f"SMTP not configured. Email to {to_email} subject={subject} logged only.")
        return

    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain', 'utf-8'))

    if smtp_port == 465:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=SMTP_TIMEOUT) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=SMTP_TIMEOUT) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

    logger.info(f"Email sent to {to_email} subject={subject}")


def _send_email(to_email: str, subject: str, body: str) -> None:
    def _worker():
        try:
            _send_email_sync(to_email, subject, body)
        except Exception as e:
            logger.error(f"Email send failed to={to_email}: {type(e).__name__}: {e}")

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()


@router.post("/password-reset/request")
async def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    """Request password reset email. Always returns success to avoid account enumeration."""
    user = db.query(User).filter(User.email == payload.email).first()

    # Always return success to prevent email enumeration.
    if not user:
        return {"status": "ok"}

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = datetime.utcnow() + timedelta(hours=1)

    user.password_reset_token_hash = token_hash
    user.password_reset_expires = expires_at
    db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_url = f"{frontend_url}/reset-password?token={token}"

    subject = "【Carat】パスワード再設定のご案内"
    body = f"""{user.display_name} 様

パスワード再設定のリクエストを受け付けました。
以下のリンクから新しいパスワードを設定してください（有効期限: 1時間）。

{reset_url}

もしこのメールに心当たりがない場合は、このメールを破棄してください。
"""

    try:
        _send_email(user.email, subject, body)
    except Exception as e:
        logging.getLogger(__name__).error(f"Password reset email send failed: {e}")
        # Still return ok to avoid leaking info.

    return {"status": "ok"}


@router.post("/password-reset/confirm")
async def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Confirm password reset using token and set new password."""
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="パスワードは8文字以上である必要があります")

    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    user = db.query(User).filter(User.password_reset_token_hash == token_hash).first()

    if not user or not user.password_reset_expires:
        raise HTTPException(status_code=400, detail="無効なトークンです")

    expires_naive = user.password_reset_expires.replace(tzinfo=None) if user.password_reset_expires.tzinfo else user.password_reset_expires
    if expires_naive < datetime.utcnow():
        raise HTTPException(status_code=400, detail="トークンの有効期限が切れています")

    user.password_hash = get_password_hash(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires = None
    db.commit()

    return {"status": "ok"}

@router.get("/health")
async def auth_health():
    return {"status": "ok", "service": "authentication"}


@router.get("/smtp-test")
async def smtp_test():
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")

    if not smtp_host or not smtp_user:
        return {"status": "not_configured", "smtp_host": smtp_host, "smtp_port": smtp_port}

    import socket
    results = {}

    for port in [465, 587]:
        try:
            sock = socket.create_connection((smtp_host, port), timeout=10)
            sock.close()
            results[f"tcp_{port}"] = "reachable"
        except Exception as e:
            results[f"tcp_{port}"] = f"{type(e).__name__}: {e}"

    try:
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            server.starttls()
        server.login(smtp_user, smtp_password)
        results["login"] = "success"
        server.quit()
    except Exception as e:
        results["login"] = f"{type(e).__name__}: {e}"

    return {"status": "tested", "smtp_host": smtp_host, "smtp_port": smtp_port, "results": results}

@router.post("/send-verification-code")
async def send_verification_code(request: PhoneVerificationRequest, db: Session = Depends(get_db)):
    """携帯番号にSMS認証コードを送信"""
    if not PHONE_AUTH_ENABLED:
        raise HTTPException(status_code=501, detail="Phone authentication is not enabled")
    
    # 携帯番号の形式をバリデーション
    if not sms_service.validate_phone_number(request.phone_number):
        raise HTTPException(
            status_code=400,
            detail="無効な携帯番号形式です"
        )
    
    # 携帯番号をフォーマット
    formatted_phone = sms_service.format_phone_number(request.phone_number)
    
    # 既存ユーザーチェック
    existing_user = db.query(User).filter(User.phone_number == formatted_phone).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="この携帯番号は既に登録されています"
        )
    
    # 認証コード生成
    verification_code = sms_service.generate_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=5)  # 5分間有効
    
    # SMS送信
    if not sms_service.send_verification_sms(formatted_phone, verification_code):
        raise HTTPException(
            status_code=500,
            detail="SMS送信に失敗しました"
        )
    
    # 一時的にセッションに保存（実際の実装では Redis や DB の一時テーブルを使用）
    # ここでは簡易的にユーザーレコードを作成して認証コードを保存
    temp_user = db.query(User).filter(User.phone_number == formatted_phone).first()
    if not temp_user:
        temp_user = User(
            phone_number=formatted_phone,
            email="temp@temp.com",  # 一時的なメール
            password_hash="temp",   # 一時的なパスワード
            display_name="temp",    # 一時的な表示名
            phone_verification_code=verification_code,
            phone_verification_expires=expires_at,
            is_active=False  # 認証完了まで非アクティブ
        )
        db.add(temp_user)
    else:
        temp_user.phone_verification_code = verification_code
        temp_user.phone_verification_expires = expires_at
    
    db.commit()
    
    return {"message": "認証コードを送信しました", "expires_in": 300}

@router.post("/verify-phone")
async def verify_phone(request: PhoneVerificationConfirm, db: Session = Depends(get_db)):
    """携帯番号の認証コードを確認"""
    if not PHONE_AUTH_ENABLED:
        raise HTTPException(status_code=501, detail="Phone authentication is not enabled")
    
    formatted_phone = sms_service.format_phone_number(request.phone_number)
    
    # ユーザー検索
    user = db.query(User).filter(User.phone_number == formatted_phone).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="認証コードが見つかりません"
        )
    
    # 認証コードチェック
    if user.phone_verification_code != request.verification_code:
        raise HTTPException(
            status_code=400,
            detail="認証コードが正しくありません"
        )
    
    # 有効期限チェック
    expires_naive = user.phone_verification_expires.replace(tzinfo=None) if user.phone_verification_expires.tzinfo else user.phone_verification_expires
    if expires_naive < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="認証コードの有効期限が切れています"
        )
    
    # 認証完了
    user.phone_verified = True
    user.phone_verification_code = None
    user.phone_verification_expires = None
    db.commit()
    
    return {"message": "携帯番号の認証が完了しました"}

@router.post("/register-with-phone", response_model=UserSchema)
async def register_with_phone(user_data: UserRegistrationStep1, db: Session = Depends(get_db)):
    """携帯番号認証後のユーザー登録"""
    if not PHONE_AUTH_ENABLED:
        raise HTTPException(status_code=501, detail="Phone authentication is not enabled")
    
    formatted_phone = sms_service.format_phone_number(user_data.phone_number)
    
    # メールアドレス重複チェック
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="このメールアドレスは既に使用されています"
        )
    
    # 認証済みユーザーを検索、なければ新規作成
    user = db.query(User).filter(User.phone_number == formatted_phone).first()
    
    if user:
        # 既存ユーザーの場合は情報を更新
        if not user.phone_verified:
            raise HTTPException(
                status_code=400,
                detail="携帯番号の認証が完了していません"
            )
        user.email = user_data.email
        user.password_hash = get_password_hash(user_data.password)
        user.display_name = user_data.display_name
        user.is_active = True
        user.membership_type = "premium"
    else:
        # 新規ユーザー作成（開発環境用：認証をスキップ）
        user = User(
            phone_number=formatted_phone,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            display_name=user_data.display_name,
            is_active=True,
            membership_type="premium",
            phone_verified=True  # 開発環境用
        )
        db.add(user)
        db.flush()  # IDを取得するため
    
    db.commit()
    db.refresh(user)
    
    # プロフィール作成（既存チェック）
    existing_profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not existing_profile:
        db_profile = Profile(
            user_id=user.id,
            handle=f"user_{user.id}"
        )
        db.add(db_profile)
        db.commit()
    
    # マッチングプロフィール作成（ニックネームに表示名を設定）
    existing_matching_profile = db.query(MatchingProfile).filter(MatchingProfile.user_id == user.id).first()
    if not existing_matching_profile:
        matching_profile = MatchingProfile(
            user_id=user.id,
            nickname=user_data.display_name,  # 表示名をニックネームに設定
            display_flag=True,
            prefecture="未設定"
        )
        db.add(matching_profile)
        db.commit()
    
    return user

@router.post("/register", response_model=UserSchema)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """Email-based user registration"""
    # メールアドレスの重複チェック
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    hashed_password = get_password_hash(user.password)
    
    db_user = User(
        email=user.email,
        password_hash=hashed_password,
        display_name=user.display_name,
        phone_number=user.phone_number,
        residence_country=user.residence_country,
        membership_type="premium"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    db_profile = Profile(
        user_id=db_user.id,
        handle=f"user_{db_user.id}"
    )
    db.add(db_profile)
    
    db_matching_profile = MatchingProfile(
        user_id=db_user.id,
        display_flag=True,  # デフォルトで公開
        prefecture='未設定'
    )
    db.add(db_matching_profile)
    
    db.commit()
    
    return db_user

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_legacy_paid:
        if not getattr(user, 'email_verified', False):
            raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")
        if getattr(user, 'kyc_status', 'UNVERIFIED') != 'VERIFIED':
            raise HTTPException(status_code=403, detail="KYC_NOT_VERIFIED")
        if getattr(user, 'subscription_status', None) != 'active':
            raise HTTPException(status_code=403, detail="SUBSCRIPTION_NOT_ACTIVE")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_legacy_paid:
        if not getattr(user, 'email_verified', False):
            raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")
        if getattr(user, 'kyc_status', 'UNVERIFIED') != 'VERIFIED':
            raise HTTPException(status_code=403, detail="KYC_NOT_VERIFIED")
        if getattr(user, 'subscription_status', None) != 'active':
            raise HTTPException(status_code=403, detail="SUBSCRIPTION_NOT_ACTIVE")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserSchema)
async def read_users_me(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get avatar URL from matching_profiles or profiles
    from app.models import MatchingProfile, Profile
    avatar_url = None
    matching_profile = db.query(MatchingProfile).filter(MatchingProfile.user_id == current_user.id).first()
    if matching_profile and matching_profile.avatar_url:
        avatar_url = matching_profile.avatar_url
    else:
        profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
        if profile and profile.avatar_url:
            avatar_url = profile.avatar_url
    
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "nickname": current_user.display_name,
        "membership_type": current_user.membership_type,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "avatar_url": avatar_url,
        "kyc_status": current_user.kyc_status or "UNVERIFIED",
        "subscription_status": current_user.subscription_status,
        "is_legacy_paid": current_user.is_legacy_paid,
    }
    
    return user_dict

@router.get("/admin/users", response_model=List[UserSchema])
async def get_all_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users

@router.get("/admin/posts")
async def get_all_posts(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    from app.models import Post
    posts = db.query(Post).all()
    return posts

@router.get("/admin/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    return {
        "total_users": total_users,
        "active_users": active_users
    }

@router.post("/fix-meeting-style")
def fix_meeting_style_column(db: Session = Depends(get_db)):
    """meeting_styleカラムを削除（緊急対応用）"""
    try:
        db.execute(text("ALTER TABLE matching_profiles DROP COLUMN IF EXISTS meeting_style"))
        db.commit()
        return {"status": "success", "message": "meeting_style column dropped"}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}

@router.post("/add-phone-number-column")
def add_phone_number_column(db: Session = Depends(get_db)):
    """phone_numberカラムを追加（緊急対応用）"""
    try:
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)"))
        db.commit()
        return {"status": "success", "message": "phone_number column added successfully"}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
