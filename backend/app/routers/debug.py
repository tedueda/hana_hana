"""
Debug router for listing recent users
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from typing import List, Optional
from app.database import get_db
from app.models import User, Referral
from app.routers.auth import get_current_admin_user

router = APIRouter()


@router.get("/api/debug/recent-users")
def list_recent_users(
    days: int = 14,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List users registered in the last N days (admin only)"""
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Query users
    users = db.query(User).filter(
        and_(
            User.created_at >= cutoff_date,
            User.deleted_at.is_(None)
        )
    ).order_by(User.created_at.desc()).all()
    
    # Get referral info for all users
    user_ids = [u.id for u in users]
    referrals = {}
    if user_ids:
        for ref in db.query(Referral).filter(Referral.user_id.in_(user_ids)).all():
            referrals[ref.user_id] = ref
    
    # Build response
    result = []
    for user in users:
        ref = referrals.get(user.id)
        ref_code = None
        ref_type = None
        ref_status = None
        
        if ref:
            if ref.founder_code:
                ref_code = ref.founder_code
                ref_type = "founder"
                ref_status = ref.status
            elif ref.ambassador_code:
                ref_code = ref.ambassador_code
                ref_type = "ambassador"
                ref_status = ref.status
        
        result.append({
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "subscription_status": user.subscription_status,
            "membership_type": user.membership_type,
            "is_founder_free_member": user.is_founder_free_member,
            "email_verified": user.email_verified,
            "kyc_status": user.kyc_status,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "referral": {
                "code": ref_code,
                "type": ref_type,
                "status": ref_status
            } if ref else None
        })
    
    # Calculate statistics
    membership_counts = {}
    status_counts = {}
    ref_counts = {"founder": 0, "ambassador": 0, "none": 0}
    email_verified_count = 0
    
    for user_data in result:
        # Membership type
        mtype = user_data["membership_type"] or "unknown"
        membership_counts[mtype] = membership_counts.get(mtype, 0) + 1
        
        # Subscription status
        status = user_data["subscription_status"] or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
        
        # Email verification
        if user_data["email_verified"]:
            email_verified_count += 1
        
        # Referral
        if user_data["referral"]:
            ref_type = user_data["referral"]["type"]
            ref_counts[ref_type] = ref_counts.get(ref_type, 0) + 1
        else:
            ref_counts["none"] += 1
    
    return {
        "total": len(result),
        "cutoff_date": cutoff_date.isoformat(),
        "users": result,
        "statistics": {
            "membership_type": membership_counts,
            "subscription_status": status_counts,
            "email_verified": email_verified_count,
            "email_unverified": len(result) - email_verified_count,
            "referrals": ref_counts
        }
    }
