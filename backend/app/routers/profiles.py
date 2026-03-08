from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Profile
from app.schemas import Profile as ProfileSchema, ProfileUpdate
from app.auth import get_current_active_user

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


def require_premium(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.membership_type not in ("premium", "admin"):
        raise HTTPException(status_code=403, detail={"error": "premium_required"})
    return current_user


@router.get("/me", response_model=ProfileSchema)
async def read_profile_me(
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db)
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.put("/me", response_model=ProfileSchema)
async def update_profile_me(
    profile_update: ProfileUpdate,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db)
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    for field, value in profile_update.dict(exclude_unset=True).items():
        setattr(profile, field, value)
    
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/{handle}", response_model=ProfileSchema)
async def read_profile_by_handle(handle: str, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.handle == handle).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile
