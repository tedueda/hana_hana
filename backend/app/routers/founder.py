"""
STEP③: 創業メンバー & 紹介制度 API
"""
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from pydantic import BaseModel

from app.database import get_db
from app.models import User, Referral
from app.auth import get_current_active_user, get_optional_user

router = APIRouter(prefix="/api/founder", tags=["founder"])

FOUNDER_LIMIT = 200
REWARD_MONTHS = 12


# ---------- Schemas ----------

class FounderStatusResponse(BaseModel):
    total_founders: int
    remaining_slots: int
    limit: int
    is_accepting: bool


class ReferralStatsResponse(BaseModel):
    ref_code: str
    total_referrals: int
    paid_referrals: int


class RegisterWithRefRequest(BaseModel):
    ref_code: str


# ---------- Helpers ----------

def _generate_ref_code(length: int = 8) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def _ensure_ref_code(db: Session, user: User) -> str:
    """Ensure user has a ref_code; generate one if missing."""
    if user.ref_code:
        return user.ref_code
    for _ in range(10):
        code = _generate_ref_code()
        existing = db.query(User).filter(User.ref_code == code).first()
        if not existing:
            user.ref_code = code
            db.commit()
            db.refresh(user)
            return code
    raise HTTPException(status_code=500, detail="Failed to generate unique ref code")


# ---------- Endpoints ----------

@router.get("/status", response_model=FounderStatusResponse)
async def get_founder_status(db: Session = Depends(get_db)):
    """創業メンバーの残り枠を取得（公開API）"""
    total = db.query(sql_func.count(User.id)).filter(User.is_founder == True).scalar() or 0
    remaining = max(0, FOUNDER_LIMIT - total)
    return FounderStatusResponse(
        total_founders=total,
        remaining_slots=remaining,
        limit=FOUNDER_LIMIT,
        is_accepting=remaining > 0,
    )


@router.post("/register-founder")
async def register_as_founder(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """創業メンバーとして登録"""
    if current_user.is_founder:
        raise HTTPException(status_code=400, detail="Already a founder member")

    total = db.query(sql_func.count(User.id)).filter(User.is_founder == True).scalar() or 0
    if total >= FOUNDER_LIMIT:
        raise HTTPException(status_code=409, detail="Founder registration is closed (200 members reached)")

    current_user.is_founder = True
    db.commit()
    db.refresh(current_user)
    return {"message": "創業メンバーに登録されました", "is_founder": True}


@router.get("/my-ref-code")
async def get_my_ref_code(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """自分の紹介コードを取得（無ければ自動生成）"""
    code = _ensure_ref_code(db, current_user)
    return {"ref_code": code, "referral_url": f"/register?ref={code}"}


@router.get("/referral-stats", response_model=ReferralStatsResponse)
async def get_referral_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """自分の紹介実績を取得"""
    code = _ensure_ref_code(db, current_user)

    total = db.query(sql_func.count(Referral.id)).filter(Referral.ref_code == code).scalar() or 0

    cutoff = datetime.utcnow() - timedelta(days=REWARD_MONTHS * 30)
    paid = (
        db.query(sql_func.count(Referral.id))
        .filter(Referral.ref_code == code, Referral.paid_at != None, Referral.paid_at >= cutoff)
        .scalar()
        or 0
    )

    return ReferralStatsResponse(ref_code=code, total_referrals=total, paid_referrals=paid)


@router.post("/apply-referral")
async def apply_referral(
    body: RegisterWithRefRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """紹介コードを自分のアカウントに紐付ける（登録時1回のみ）"""
    if current_user.referred_by_user_id is not None:
        raise HTTPException(status_code=400, detail="Referral already applied")

    referrer = db.query(User).filter(User.ref_code == body.ref_code).first()
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    if referrer.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")

    current_user.referred_by_user_id = referrer.id
    db.commit()

    # Record in referrals table
    referral = Referral(user_id=current_user.id, ref_code=body.ref_code)
    db.add(referral)
    db.commit()

    return {"message": "紹介コードが適用されました"}


@router.get("/leader-dashboard")
async def leader_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """リーダーダッシュボード（role=leader のみ）"""
    if current_user.role != "leader" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Leader access required")

    code = _ensure_ref_code(db, current_user)

    total_referrals = db.query(sql_func.count(Referral.id)).filter(Referral.ref_code == code).scalar() or 0
    paid_referrals = (
        db.query(sql_func.count(Referral.id))
        .filter(Referral.ref_code == code, Referral.paid_at != None)
        .scalar()
        or 0
    )

    return {
        "ref_code": code,
        "total_referrals": total_referrals,
        "paid_referrals": paid_referrals,
    }
