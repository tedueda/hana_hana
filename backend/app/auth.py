from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import TokenData
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.password_hash):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user


async def get_optional_user(token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=False)), db: Session = Depends(get_db)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None
    
    user = get_user_by_email(db, email=email)
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_premium_user(current_user: User = Depends(get_current_active_user)):
    if current_user.membership_type not in ("premium", "admin"):
        raise HTTPException(status_code=403, detail="Premium membership required")
    return current_user

async def get_current_admin_user(current_user: User = Depends(get_current_active_user)):
    is_admin = current_user.membership_type == "admin"
    if hasattr(current_user, "role") and getattr(current_user, "role", None) == "admin":
        is_admin = True
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user


def is_user_paid_member(user: User) -> bool:
    """Check if user has paid member access (subscription active OR legacy paid)."""
    return user.is_legacy_paid or user.subscription_status == "active"


def is_user_kyc_verified(user: User) -> bool:
    """Check if user has completed KYC (verified OR legacy paid)."""
    return user.is_legacy_paid or user.kyc_status == "VERIFIED"


def can_user_perform_action(user: User) -> bool:
    """Check if user can perform restricted actions (post, comment, chat, etc.)."""
    return is_user_paid_member(user) and is_user_kyc_verified(user)


async def get_current_verified_user(current_user: User = Depends(get_current_active_user)):
    """
    Get current user who can perform restricted actions.
    Requires: active subscription (or legacy paid) AND KYC verified (or legacy paid).
    """
    if not is_user_paid_member(current_user):
        raise HTTPException(
            status_code=403, 
            detail="SUBSCRIPTION_REQUIRED",
            headers={"X-Error-Code": "SUBSCRIPTION_REQUIRED"}
        )
    
    if not is_user_kyc_verified(current_user):
        raise HTTPException(
            status_code=403, 
            detail="KYC_REQUIRED",
            headers={"X-Error-Code": "KYC_REQUIRED"}
        )
    
    return current_user
