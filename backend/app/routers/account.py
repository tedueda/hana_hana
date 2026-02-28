from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.auth import get_current_user, get_password_hash, verify_password
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter(prefix="/api/account", tags=["account"])


# Pydanticモデル
class AccountResponse(BaseModel):
    id: int
    email: str
    display_name: str
    membership_type: str
    phone_number: Optional[str]
    real_name: Optional[str]
    is_verified: bool
    two_factor_enabled: bool
    is_active: bool
    created_at: str
    subscription_status: Optional[str] = None
    kyc_status: Optional[str] = None
    is_legacy_paid: Optional[bool] = None
    stripe_customer_id: Optional[str] = None
    residence_country: Optional[str] = None
    preferred_lang: Optional[str] = None
    
    class Config:
        from_attributes = True


class UpdateAccountRequest(BaseModel):
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None
    phone_number: Optional[str] = None
    real_name: Optional[str] = None
    residence_country: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    password: str
    confirmation: str  # "DELETE" という文字列を要求


@router.get("/me", response_model=AccountResponse)
def get_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """現在のユーザーのアカウント情報を取得"""
    return AccountResponse(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        membership_type=current_user.membership_type,
        phone_number=current_user.phone_number,
        real_name=current_user.real_name,
        is_verified=current_user.is_verified or False,
        two_factor_enabled=current_user.two_factor_enabled or False,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
        subscription_status=current_user.subscription_status,
        kyc_status=current_user.kyc_status,
        is_legacy_paid=current_user.is_legacy_paid,
        stripe_customer_id=current_user.stripe_customer_id,
        residence_country=current_user.residence_country,
        preferred_lang=current_user.preferred_lang,
    )


@router.put("/me")
def update_account(
    payload: UpdateAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """アカウント情報を更新"""
    
    # メールアドレスの変更チェック
    if payload.email and payload.email != current_user.email:
        # 既に使用されているメールアドレスかチェック
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="このメールアドレスは既に使用されています")
        current_user.email = payload.email
    
    # 表示名の更新
    if payload.display_name:
        current_user.display_name = payload.display_name

    # 携帯番号の更新（users.phone_number に保存）
    if payload.phone_number is not None:
        if payload.phone_number:
            existing = db.query(User).filter(
                User.phone_number == payload.phone_number,
                User.id != current_user.id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="この携帯番号は既に使用されています")
            current_user.phone_number = payload.phone_number
        else:
            current_user.phone_number = None
    
    # 本名の更新
    if payload.real_name is not None:
        current_user.real_name = payload.real_name if payload.real_name else None

    # 居住国の更新
    if payload.residence_country is not None:
        current_user.residence_country = payload.residence_country if payload.residence_country else None
    
    db.commit()
    db.refresh(current_user)

    return {
        "message": "アカウント情報を更新しました",
        "account": AccountResponse(
            id=current_user.id,
            email=current_user.email,
            display_name=current_user.display_name,
            membership_type=current_user.membership_type,
            phone_number=current_user.phone_number,
            real_name=current_user.real_name,
            is_verified=current_user.is_verified or False,
            two_factor_enabled=current_user.two_factor_enabled or False,
            is_active=current_user.is_active,
            created_at=current_user.created_at.isoformat() if current_user.created_at else "",
            subscription_status=current_user.subscription_status,
            kyc_status=current_user.kyc_status,
            is_legacy_paid=current_user.is_legacy_paid,
            stripe_customer_id=current_user.stripe_customer_id,
            residence_country=current_user.residence_country,
            preferred_lang=current_user.preferred_lang,
        )
    }


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """パスワードを変更"""
    
    # 現在のパスワードを確認
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="現在のパスワードが正しくありません")
    
    # 新しいパスワードのバリデーション
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="パスワードは8文字以上である必要があります")
    
    # パスワードを更新
    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    
    return {"message": "パスワードを変更しました"}


@router.post("/delete")
def delete_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """アカウントを削除（論理削除）"""
    
    # パスワードを確認
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="パスワードが正しくありません")
    
    # 確認文字列をチェック
    if payload.confirmation != "DELETE":
        raise HTTPException(status_code=400, detail="確認文字列が正しくありません")
    
    # 論理削除（is_activeをFalseに設定）
    current_user.is_active = False
    db.commit()
    
    return {"message": "アカウントを削除しました"}


@router.post("/reactivate")
def reactivate_account(
    email: EmailStr,
    password: str,
    db: Session = Depends(get_db)
):
    """削除されたアカウントを再有効化"""
    
    # ユーザーを検索
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    # パスワードを確認
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="パスワードが正しくありません")
    
    # アカウントを再有効化
    user.is_active = True
    db.commit()
    
    return {"message": "アカウントを再有効化しました"}
