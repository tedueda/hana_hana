from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.auth import get_current_active_user
import os

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/status")
def get_billing_status(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """
    現在ログイン中ユーザーのプレミアム状態を返却します。
    仕様: membership_type が 'premium' のときに premium=True
    追加で membership_type を返し、将来の拡張に備えます。
    """
    premium = (
        current_user.membership_type in ("premium", "admin", "founder_free")
        or current_user.is_legacy_paid is True
        or getattr(current_user, 'subscription_status', None) == 'active'
        or getattr(current_user, 'subscription_exempt', False)
    )
    return {"premium": premium, "membership_type": current_user.membership_type}


@router.post("/checkout")
def create_checkout_session(current_user: User = Depends(get_current_active_user)):
    """
    Stripe Checkout を開始するためのエンドポイント。
    現段階ではダミーのURLを返却。将来的にStripe連携し、実際のCheckout URLを生成する。
    """
    # 将来的には Stripe のセッションを作成して返す。
    # 例: session = stripe.checkout.Session.create(...)
    # return {"url": session.url}
    url = os.getenv("STRIPE_CHECKOUT_TEST_URL", "https://checkout.stripe.com/pay/cs_test_dummy")
    return {"url": url}
