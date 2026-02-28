from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from datetime import datetime, timezone
from app.models import User, Post, Comment, PointEvent
from app.auth import get_current_active_user

router = APIRouter(prefix="/api/users", tags=["users"])

# Supported languages
SUPPORTED_LANGUAGES = ["ja", "en", "ko", "es", "pt", "fr", "it", "de"]

class LanguagePreference(BaseModel):
    preferred_lang: str

@router.get("/{user_id}")
async def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get user information by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "membership_type": user.membership_type,
        "carats": user.carats or 0,
        "created_at": user.created_at
    }

@router.get("/me/language")
async def get_user_language(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's preferred language"""
    return {
        "preferred_lang": current_user.preferred_lang or "ja"
    }

@router.put("/me/language")
async def update_user_language(
    language: LanguagePreference,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user's preferred language"""
    if language.preferred_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported language. Supported: {', '.join(SUPPORTED_LANGUAGES)}"
        )
    
    current_user.preferred_lang = language.preferred_lang
    db.commit()
    db.refresh(current_user)
    
    return {
        "preferred_lang": current_user.preferred_lang,
        "message": "Language preference updated successfully"
    }

@router.get("/me/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user statistics including carat points"""
    from app.models import Reaction

    posts_count = db.query(Post).filter(Post.user_id == current_user.id).count()

    comments_count = db.query(Comment).filter(Comment.user_id == current_user.id).count()

    likes_received = db.query(func.count(Reaction.id)).join(
        Post, Reaction.target_id == Post.id
    ).filter(
        Post.user_id == current_user.id,
        Reaction.target_type == 'post',
        Reaction.reaction_type == 'like'
    ).scalar() or 0

    total_points = current_user.carats or 0

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_points = db.query(func.coalesce(func.sum(PointEvent.points), 0)).filter(
        PointEvent.user_id == current_user.id,
        PointEvent.created_at >= month_start
    ).scalar() or 0

    return {
        "posts_count": posts_count,
        "comments_count": comments_count,
        "likes_received": likes_received,
        "total_points": total_points,
        "monthly_points": monthly_points,
    }
