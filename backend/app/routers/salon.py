from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    User, Profile, MatchingProfile, MatchingProfileImage,
    SalonRoom, SalonParticipant, SalonMessage,
    SalonCategory, SalonRoomTag, SalonPost, SalonComment, SalonReport,
)
from app.auth import get_current_active_user, get_optional_user
from app.schemas import (
    SalonRoomCreate, SalonRoomUpdate, SalonRoom as SalonRoomSchema,
    SalonParticipantCreate, SalonParticipant as SalonParticipantSchema,
    SalonMessageCreate, SalonMessage as SalonMessageSchema,
    SalonCategorySchema, SalonRoomExtended, SalonRoomCreateExtended,
    SalonPostCreate, SalonPostSchema,
    SalonCommentCreate, SalonCommentSchema,
    SalonReportCreate, SalonReportSchema,
)

router = APIRouter(prefix="/api/salon", tags=["salon"])

VALID_IDENTITIES = [
    'gay', 'lesbian', 'bisexual', 'transgender', 'questioning', 'other',
    'ゲイ', 'レズ', 'レズビアン', 'バイセクシュアル', 'バイセクシャル', 'トランスジェンダー', 'クエスチョニング', 'クィア',
    'ストレート・アライ', 'その他', '非公開', '男性', '女性', '非表示',
    'ALL'
]


def require_premium(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.membership_type not in ("premium", "admin", "founder_free"):
        raise HTTPException(status_code=403, detail={"error": "premium_required", "message": "プレミアム会員のみ利用可能です"})
    return current_user


def get_user_identity(user_id: int, db: Session) -> Optional[str]:
    matching_profile = db.query(MatchingProfile).filter(MatchingProfile.user_id == user_id).first()
    if matching_profile:
        # Prefer community_category over legacy identity field
        cat = getattr(matching_profile, 'community_category', None)
        if cat:
            return cat
        if matching_profile.identity:
            return matching_profile.identity
    return None


_IDENTITY_EQUIVALENCES: List[set] = [
    {'gay', 'ゲイ'},
    {'lesbian', 'レズビアン', 'レズ'},
    {'bisexual', 'バイセクシュアル', 'バイセクシャル'},
    {'transgender', 'トランスジェンダー'},
    {'questioning', 'クィア', 'クエスチョニング', 'queer'},
    {'other', 'その他', 'ストレート・アライ'},
]


def _normalize_identity(value: str) -> set:
    """Return the equivalence set containing *value* (case-insensitive)."""
    low = value.strip().lower()
    for group in _IDENTITY_EQUIVALENCES:
        if low in {v.lower() for v in group}:
            return group
    return {value}


def check_identity_match(user_identity: Optional[str], target_identities: List[str], is_logged_in: bool = True) -> bool:
    # 未ログインユーザーには全てのルームを表示（閲覧のみ）
    if not is_logged_in:
        return True
    if not target_identities:
        return True
    if 'ALL' in target_identities:
        return True
    if not user_identity:
        return False
    # Exact match first
    if user_identity in target_identities:
        return True
    # Equivalence-based match (e.g. 'ゲイ' matches 'gay')
    user_group = _normalize_identity(user_identity)
    for tid in target_identities:
        if _normalize_identity(tid) & user_group:
            return True
    return False


@router.get("/rooms", response_model=List[SalonRoomSchema])
async def list_rooms(
    room_type: Optional[str] = Query(None),
    is_active: bool = Query(True),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    user_identity = get_user_identity(current_user.id, db) if current_user else None
    
    q = db.query(SalonRoom).filter(SalonRoom.is_active == is_active)
    
    if room_type:
        q = q.filter(SalonRoom.room_type == room_type)
    
    q = q.order_by(SalonRoom.created_at.desc())
    total = q.count()
    rooms = q.offset((page - 1) * size).limit(size).all()
    
    is_logged_in = current_user is not None
    result = []
    for room in rooms:
        if not check_identity_match(user_identity, room.target_identities, is_logged_in):
            continue
        
        participant_count = db.query(func.count(SalonParticipant.id)).filter(
            SalonParticipant.room_id == room.id
        ).scalar()
        
        creator = db.query(User).filter(User.id == room.creator_id).first()
        
        result.append({
            "id": room.id,
            "creator_id": room.creator_id,
            "theme": room.theme,
            "description": room.description,
            "target_identities": room.target_identities,
            "room_type": room.room_type,
            "allow_anonymous": room.allow_anonymous,
            "is_active": room.is_active,
            "created_at": room.created_at,
            "updated_at": room.updated_at,
            "participant_count": participant_count,
            "creator_display_name": creator.display_name if creator else None,
        })
    
    return result


@router.get("/public-rooms")
async def list_public_rooms(
    room_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """サロンルーム一覧（公開）。未ログインユーザーでもテーマ・説明を閲覧可能。"""
    q = db.query(SalonRoom).filter(SalonRoom.is_active == True)

    if room_type:
        q = q.filter(SalonRoom.room_type == room_type)

    q = q.order_by(SalonRoom.created_at.desc())
    rooms = q.offset((page - 1) * size).limit(size).all()

    result = []
    for room in rooms:
        participant_count = db.query(func.count(SalonParticipant.id)).filter(
            SalonParticipant.room_id == room.id
        ).scalar()

        creator = db.query(User).filter(User.id == room.creator_id).first()

        result.append({
            "id": room.id,
            "creator_id": room.creator_id,
            "theme": room.theme,
            "description": room.description,
            "target_identities": room.target_identities,
            "room_type": room.room_type,
            "allow_anonymous": room.allow_anonymous,
            "is_active": room.is_active,
            "created_at": room.created_at,
            "updated_at": room.updated_at,
            "participant_count": participant_count,
            "creator_display_name": creator.display_name if creator else None,
        })

    return result


@router.post("/rooms", response_model=SalonRoomSchema, status_code=201)
def create_room(
    room_data: SalonRoomCreate,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    for identity in room_data.target_identities:
        if identity not in VALID_IDENTITIES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid identity: {identity}. Must be one of: {VALID_IDENTITIES}"
            )
    
    room = SalonRoom(
        creator_id=current_user.id,
        theme=room_data.theme,
        description=room_data.description,
        target_identities=room_data.target_identities,
        room_type=room_data.room_type.value,
        allow_anonymous=room_data.allow_anonymous,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    
    participant = SalonParticipant(
        room_id=room.id,
        user_id=current_user.id,
    )
    db.add(participant)
    db.commit()
    
    return {
        "id": room.id,
        "creator_id": room.creator_id,
        "theme": room.theme,
        "description": room.description,
        "target_identities": room.target_identities,
        "room_type": room.room_type,
        "allow_anonymous": room.allow_anonymous,
        "is_active": room.is_active,
        "created_at": room.created_at,
        "updated_at": room.updated_at,
        "participant_count": 1,
        "creator_display_name": current_user.display_name,
    }


@router.get("/rooms/{room_id}", response_model=SalonRoomSchema)
def get_room(
    room_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    user_identity = get_user_identity(current_user.id, db)
    if not check_identity_match(user_identity, room.target_identities):
        raise HTTPException(status_code=403, detail="You are not allowed to access this room")
    
    participant_count = db.query(func.count(SalonParticipant.id)).filter(
        SalonParticipant.room_id == room.id
    ).scalar()
    
    creator = db.query(User).filter(User.id == room.creator_id).first()
    
    return {
        "id": room.id,
        "creator_id": room.creator_id,
        "theme": room.theme,
        "description": room.description,
        "target_identities": room.target_identities,
        "room_type": room.room_type,
        "allow_anonymous": room.allow_anonymous,
        "is_active": room.is_active,
        "created_at": room.created_at,
        "updated_at": room.updated_at,
        "participant_count": participant_count,
        "creator_display_name": creator.display_name if creator else None,
    }


@router.put("/rooms/{room_id}", response_model=SalonRoomSchema)
def update_room(
    room_id: int,
    room_data: SalonRoomUpdate,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room.creator_id != current_user.id and current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Only the room creator can update the room")
    
    if room_data.target_identities:
        for identity in room_data.target_identities:
            if identity not in VALID_IDENTITIES:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid identity: {identity}. Must be one of: {VALID_IDENTITIES}"
                )
    
    update_data = room_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "room_type" and value:
            setattr(room, field, value.value if hasattr(value, 'value') else value)
        else:
            setattr(room, field, value)
    
    db.commit()
    db.refresh(room)
    
    participant_count = db.query(func.count(SalonParticipant.id)).filter(
        SalonParticipant.room_id == room.id
    ).scalar()
    
    creator = db.query(User).filter(User.id == room.creator_id).first()
    
    return {
        "id": room.id,
        "creator_id": room.creator_id,
        "theme": room.theme,
        "description": room.description,
        "target_identities": room.target_identities,
        "room_type": room.room_type,
        "allow_anonymous": room.allow_anonymous,
        "is_active": room.is_active,
        "created_at": room.created_at,
        "updated_at": room.updated_at,
        "participant_count": participant_count,
        "creator_display_name": creator.display_name if creator else None,
    }


@router.post("/rooms/{room_id}/join", response_model=SalonParticipantSchema)
def join_room(
    room_id: int,
    anonymous_name: Optional[str] = None,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if not room.is_active:
        raise HTTPException(status_code=400, detail="Room is not active")
    
    user_identity = get_user_identity(current_user.id, db)
    if not check_identity_match(user_identity, room.target_identities):
        raise HTTPException(status_code=403, detail="Your identity does not match the room requirements")
    
    existing = db.query(SalonParticipant).filter(
        SalonParticipant.room_id == room_id,
        SalonParticipant.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Already joined this room")
    
    if anonymous_name and not room.allow_anonymous:
        raise HTTPException(status_code=400, detail="This room does not allow anonymous participation")
    
    participant = SalonParticipant(
        room_id=room_id,
        user_id=current_user.id,
        anonymous_name=anonymous_name if room.allow_anonymous else None,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    
    # Get avatar URL from matching_profile_images
    avatar_url = None
    first_image = (
        db.query(MatchingProfileImage)
        .filter(MatchingProfileImage.profile_id == current_user.id)
        .order_by(MatchingProfileImage.display_order)
        .first()
    )
    if first_image:
        avatar_url = first_image.image_url
    else:
        # Fallback to profile avatar_url
        profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
        if profile and profile.avatar_url:
            avatar_url = profile.avatar_url
    
    return {
        "id": participant.id,
        "room_id": participant.room_id,
        "user_id": participant.user_id,
        "anonymous_name": participant.anonymous_name,
        "joined_at": participant.joined_at,
        "user_display_name": current_user.display_name,
        "user_avatar_url": avatar_url,
    }


@router.delete("/rooms/{room_id}/leave")
def leave_room(
    room_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    participant = db.query(SalonParticipant).filter(
        SalonParticipant.room_id == room_id,
        SalonParticipant.user_id == current_user.id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Not a participant of this room")
    
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if room and room.creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="Room creator cannot leave the room")
    
    db.delete(participant)
    db.commit()
    
    return {"status": "ok", "message": "Left the room"}


@router.get("/rooms/{room_id}/participants", response_model=List[SalonParticipantSchema])
def list_participants(
    room_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    user_identity = get_user_identity(current_user.id, db)
    if not check_identity_match(user_identity, room.target_identities):
        raise HTTPException(status_code=403, detail="You are not allowed to access this room")
    
    participants = db.query(SalonParticipant).filter(
        SalonParticipant.room_id == room_id
    ).all()
    
    result = []
    for p in participants:
        user = db.query(User).filter(User.id == p.user_id).first()
        
        # Get avatar URL from matching_profile_images (main image with lowest display_order)
        avatar_url = None
        first_image = (
            db.query(MatchingProfileImage)
            .filter(MatchingProfileImage.profile_id == p.user_id)
            .order_by(MatchingProfileImage.display_order)
            .first()
        )
        if first_image:
            avatar_url = first_image.image_url
        else:
            # Fallback to profile avatar_url if no matching_profile_images
            profile = db.query(Profile).filter(Profile.user_id == p.user_id).first()
            if profile and profile.avatar_url:
                avatar_url = profile.avatar_url
        
        result.append({
            "id": p.id,
            "room_id": p.room_id,
            "user_id": p.user_id,
            "anonymous_name": p.anonymous_name,
            "joined_at": p.joined_at,
            "user_display_name": user.display_name if user else None,
            "user_avatar_url": avatar_url,
        })
    
    return result


@router.get("/rooms/{room_id}/messages", response_model=List[SalonMessageSchema])
def list_messages(
    room_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    user_identity = get_user_identity(current_user.id, db)
    if not check_identity_match(user_identity, room.target_identities):
        raise HTTPException(status_code=403, detail="You are not allowed to access this room")
    
    participant = db.query(SalonParticipant).filter(
        SalonParticipant.room_id == room_id,
        SalonParticipant.user_id == current_user.id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="You must join the room to view messages")
    
    messages = db.query(SalonMessage).filter(
        SalonMessage.room_id == room_id
    ).order_by(SalonMessage.created_at.desc()).offset((page - 1) * size).limit(size).all()
    
    result = []
    for msg in messages:
        user = db.query(User).filter(User.id == msg.user_id).first()
        
        # Get avatar URL from matching_profile_images (main image with lowest display_order)
        avatar_url = None
        first_image = (
            db.query(MatchingProfileImage)
            .filter(MatchingProfileImage.profile_id == msg.user_id)
            .order_by(MatchingProfileImage.display_order)
            .first()
        )
        if first_image:
            avatar_url = first_image.image_url
        else:
            # Fallback to profile avatar_url if no matching_profile_images
            profile = db.query(Profile).filter(Profile.user_id == msg.user_id).first()
            if profile and profile.avatar_url:
                avatar_url = profile.avatar_url
        
        sender_participant = db.query(SalonParticipant).filter(
            SalonParticipant.room_id == room_id,
            SalonParticipant.user_id == msg.user_id
        ).first()
        
        if msg.is_anonymous and room.allow_anonymous:
            result.append({
                "id": msg.id,
                "room_id": msg.room_id,
                "user_id": msg.user_id,
                "is_anonymous": msg.is_anonymous,
                "body": msg.body,
                "created_at": msg.created_at,
                "user_display_name": None,
                "user_avatar_url": None,
                "anonymous_name": sender_participant.anonymous_name if sender_participant else "匿名",
            })
        else:
            result.append({
                "id": msg.id,
                "room_id": msg.room_id,
                "user_id": msg.user_id,
                "is_anonymous": msg.is_anonymous,
                "body": msg.body,
                "created_at": msg.created_at,
                "user_display_name": user.display_name if user else None,
                "user_avatar_url": avatar_url,
                "anonymous_name": None,
            })
    
    return result


@router.post("/rooms/{room_id}/messages", response_model=SalonMessageSchema, status_code=201)
def send_message(
    room_id: int,
    message_data: SalonMessageCreate,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if not room.is_active:
        raise HTTPException(status_code=400, detail="Room is not active")
    
    user_identity = get_user_identity(current_user.id, db)
    if not check_identity_match(user_identity, room.target_identities):
        raise HTTPException(status_code=403, detail="You are not allowed to access this room")
    
    participant = db.query(SalonParticipant).filter(
        SalonParticipant.room_id == room_id,
        SalonParticipant.user_id == current_user.id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=403, detail="You must join the room to send messages")
    
    if message_data.is_anonymous and not room.allow_anonymous:
        raise HTTPException(status_code=400, detail="This room does not allow anonymous messages")
    
    message = SalonMessage(
        room_id=room_id,
        user_id=current_user.id,
        is_anonymous=message_data.is_anonymous,
        body=message_data.body,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Get avatar URL from matching_profile_images
    avatar_url = None
    first_image = (
        db.query(MatchingProfileImage)
        .filter(MatchingProfileImage.profile_id == current_user.id)
        .order_by(MatchingProfileImage.display_order)
        .first()
    )
    if first_image:
        avatar_url = first_image.image_url
    else:
        # Fallback to profile avatar_url
        profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
        if profile and profile.avatar_url:
            avatar_url = profile.avatar_url
    
    if message.is_anonymous and room.allow_anonymous:
        return {
            "id": message.id,
            "room_id": message.room_id,
            "user_id": message.user_id,
            "is_anonymous": message.is_anonymous,
            "body": message.body,
            "created_at": message.created_at,
            "user_display_name": None,
            "user_avatar_url": None,
            "anonymous_name": participant.anonymous_name or "匿名",
        }
    else:
        return {
            "id": message.id,
            "room_id": message.room_id,
            "user_id": message.user_id,
            "is_anonymous": message.is_anonymous,
            "body": message.body,
            "created_at": message.created_at,
            "user_display_name": current_user.display_name,
            "user_avatar_url": avatar_url,
            "anonymous_name": None,
        }


@router.get("/identities")
def get_valid_identities(current_user: User = Depends(require_premium)):
    return {
        "identities": [
            {"value": "ゲイ", "label": "ゲイ"},
            {"value": "レズビアン", "label": "レズビアン"},
            {"value": "バイセクシュアル", "label": "バイセクシュアル"},
            {"value": "トランスジェンダー", "label": "トランスジェンダー"},
            {"value": "クィア", "label": "クィア"},
            {"value": "ストレート・アライ", "label": "ストレート・アライ"},
            {"value": "その他", "label": "その他"},
            {"value": "ALL", "label": "全カテゴリー"},
        ]
    }


@router.get("/room-types")
def get_room_types(current_user: User = Depends(require_premium)):
    return {
        "room_types": [
            {"value": "consultation", "label": "相談"},
            {"value": "exchange", "label": "交流"},
            {"value": "story", "label": "ストーリー"},
            {"value": "other", "label": "その他"},
        ]
    }


# ===== New Category-based Salon Endpoints =====

def _get_avatar_url(db: Session, user_id: int) -> Optional[str]:
    first_image = (
        db.query(MatchingProfileImage)
        .filter(MatchingProfileImage.profile_id == user_id)
        .order_by(MatchingProfileImage.display_order)
        .first()
    )
    if first_image:
        return first_image.image_url
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if profile and profile.avatar_url:
        return profile.avatar_url
    return None


@router.get("/categories", response_model=List[SalonCategorySchema])
def list_categories(db: Session = Depends(get_db)):
    try:
        cats = db.query(SalonCategory).filter(SalonCategory.is_active == True).order_by(SalonCategory.sort_order).all()
    except Exception:
        return []
    result = []
    for cat in cats:
        room_count = db.query(func.count(SalonRoom.id)).filter(
            SalonRoom.category_id == cat.id,
            SalonRoom.status == "active",
            SalonRoom.is_active == True,
        ).scalar()
        result.append({
            "id": cat.id,
            "name": cat.name,
            "display_name": cat.display_name,
            "description": cat.description,
            "group_name": cat.group_name,
            "icon": cat.icon,
            "sort_order": cat.sort_order,
            "is_active": cat.is_active,
            "warning_text": cat.warning_text,
            "room_count": room_count or 0,
        })
    return result


@router.get("/categories/{category_id}")
def get_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(SalonCategory).filter(SalonCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    room_count = db.query(func.count(SalonRoom.id)).filter(
        SalonRoom.category_id == cat.id,
        SalonRoom.status == "active",
        SalonRoom.is_active == True,
    ).scalar()
    return {
        "id": cat.id,
        "name": cat.name,
        "display_name": cat.display_name,
        "description": cat.description,
        "group_name": cat.group_name,
        "icon": cat.icon,
        "sort_order": cat.sort_order,
        "is_active": cat.is_active,
        "warning_text": cat.warning_text,
        "room_count": room_count or 0,
    }


def _build_room_dict(room: SalonRoom, db: Session) -> dict:
    participant_count = db.query(func.count(SalonParticipant.id)).filter(
        SalonParticipant.room_id == room.id
    ).scalar() or 0
    post_count = db.query(func.count(SalonPost.id)).filter(
        SalonPost.room_id == room.id,
        SalonPost.status == "active",
    ).scalar() or 0
    last_post = db.query(SalonPost.created_at).filter(
        SalonPost.room_id == room.id,
        SalonPost.status == "active",
    ).order_by(SalonPost.created_at.desc()).first()
    creator = db.query(User).filter(User.id == room.creator_id).first()
    category = db.query(SalonCategory).filter(SalonCategory.id == room.category_id).first() if room.category_id else None
    tags = db.query(SalonRoomTag.tag_name).filter(SalonRoomTag.room_id == room.id).all()
    return {
        "id": room.id,
        "category_id": room.category_id,
        "category_name": category.display_name if category else None,
        "creator_id": room.creator_id,
        "theme": room.theme,
        "description": room.description,
        "target_identities": room.target_identities or [],
        "target_audiences": room.target_audiences,
        "room_type": room.room_type,
        "visibility": getattr(room, "visibility", "public") or "public",
        "thumbnail_url": getattr(room, "thumbnail_url", None),
        "allow_anonymous": room.allow_anonymous,
        "is_active": room.is_active,
        "status": getattr(room, "status", "active") or "active",
        "tags": [t[0] for t in tags],
        "created_at": room.created_at,
        "updated_at": room.updated_at,
        "participant_count": participant_count,
        "post_count": post_count,
        "creator_display_name": creator.display_name if creator else None,
        "last_post_at": last_post[0] if last_post else None,
    }


@router.get("/categories/{category_id}/rooms", response_model=List[SalonRoomExtended])
def list_category_rooms(
    category_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    cat = db.query(SalonCategory).filter(SalonCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    q = db.query(SalonRoom).filter(
        SalonRoom.category_id == category_id,
        SalonRoom.status == "active",
        SalonRoom.is_active == True,
    )
    if tag:
        room_ids = db.query(SalonRoomTag.room_id).filter(SalonRoomTag.tag_name == tag).subquery()
        q = q.filter(SalonRoom.id.in_(room_ids))
    q = q.order_by(SalonRoom.created_at.desc())
    rooms = q.offset((page - 1) * size).limit(size).all()
    return [_build_room_dict(r, db) for r in rooms]


@router.post("/v2/rooms", response_model=SalonRoomExtended, status_code=201)
def create_room_v2(
    room_data: SalonRoomCreateExtended,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    cat = db.query(SalonCategory).filter(SalonCategory.id == room_data.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    room = SalonRoom(
        category_id=room_data.category_id,
        creator_id=current_user.id,
        theme=room_data.theme,
        description=room_data.description,
        target_identities=["ALL"],
        target_audiences=room_data.target_audiences,
        room_type="exchange",
        visibility=room_data.visibility or "public",
        thumbnail_url=room_data.thumbnail_url,
        status="active",
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    if room_data.tags:
        for tag_name in room_data.tags:
            db.add(SalonRoomTag(room_id=room.id, tag_name=tag_name.strip()))
        db.commit()

    participant = SalonParticipant(room_id=room.id, user_id=current_user.id)
    db.add(participant)
    db.commit()

    return _build_room_dict(room, db)


@router.get("/v2/rooms/{room_id}", response_model=SalonRoomExtended)
def get_room_v2(room_id: int, db: Session = Depends(get_db)):
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return _build_room_dict(room, db)


# ── Posts ──

@router.get("/v2/rooms/{room_id}/posts", response_model=List[SalonPostSchema])
def list_posts(
    room_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    posts = db.query(SalonPost).filter(
        SalonPost.room_id == room_id,
        SalonPost.status == "active",
    ).order_by(SalonPost.created_at.desc()).offset((page - 1) * size).limit(size).all()

    result = []
    for p in posts:
        user = db.query(User).filter(User.id == p.user_id).first()
        comment_count = db.query(func.count(SalonComment.id)).filter(
            SalonComment.post_id == p.id,
            SalonComment.status == "active",
        ).scalar() or 0
        result.append({
            "id": p.id,
            "room_id": p.room_id,
            "user_id": p.user_id,
            "content": p.content,
            "status": p.status,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "user_display_name": user.display_name if user else None,
            "user_avatar_url": _get_avatar_url(db, p.user_id),
            "comment_count": comment_count,
        })
    return result


@router.post("/v2/rooms/{room_id}/posts", response_model=SalonPostSchema, status_code=201)
def create_post(
    room_id: int,
    post_data: SalonPostCreate,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    existing = db.query(SalonParticipant).filter(
        SalonParticipant.room_id == room_id,
        SalonParticipant.user_id == current_user.id,
    ).first()
    if not existing:
        db.add(SalonParticipant(room_id=room_id, user_id=current_user.id))
        db.commit()

    post = SalonPost(
        room_id=room_id,
        user_id=current_user.id,
        content=post_data.content,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    return {
        "id": post.id,
        "room_id": post.room_id,
        "user_id": post.user_id,
        "content": post.content,
        "status": post.status,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "user_display_name": current_user.display_name,
        "user_avatar_url": _get_avatar_url(db, current_user.id),
        "comment_count": 0,
    }


# ── Comments ──

@router.get("/v2/posts/{post_id}/comments", response_model=List[SalonCommentSchema])
def list_comments(
    post_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    post = db.query(SalonPost).filter(SalonPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = db.query(SalonComment).filter(
        SalonComment.post_id == post_id,
        SalonComment.status == "active",
    ).order_by(SalonComment.created_at.asc()).offset((page - 1) * size).limit(size).all()

    result = []
    for c in comments:
        user = db.query(User).filter(User.id == c.user_id).first()
        result.append({
            "id": c.id,
            "post_id": c.post_id,
            "user_id": c.user_id,
            "content": c.content,
            "status": c.status,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "user_display_name": user.display_name if user else None,
            "user_avatar_url": _get_avatar_url(db, c.user_id),
        })
    return result


@router.post("/v2/posts/{post_id}/comments", response_model=SalonCommentSchema, status_code=201)
def create_comment(
    post_id: int,
    comment_data: SalonCommentCreate,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    post = db.query(SalonPost).filter(SalonPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = SalonComment(
        post_id=post_id,
        user_id=current_user.id,
        content=comment_data.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "user_id": comment.user_id,
        "content": comment.content,
        "status": comment.status,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "user_display_name": current_user.display_name,
        "user_avatar_url": _get_avatar_url(db, current_user.id),
    }


# ── Popular Salons (public) ──

@router.get("/popular-rooms", response_model=List[SalonRoomExtended])
def list_popular_rooms(
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    try:
        post_count_sub = (
            db.query(
                SalonPost.room_id,
                func.count(SalonPost.id).label("post_count"),
                func.max(SalonPost.created_at).label("last_post_at"),
            )
            .filter(SalonPost.status == "active")
            .group_by(SalonPost.room_id)
            .subquery()
        )

        rooms = (
            db.query(SalonRoom)
            .outerjoin(post_count_sub, SalonRoom.id == post_count_sub.c.room_id)
            .filter(
                SalonRoom.status == "active",
                SalonRoom.is_active == True,
                SalonRoom.visibility == "public",
            )
            .order_by(
                func.coalesce(post_count_sub.c.post_count, 0).desc(),
                func.coalesce(post_count_sub.c.last_post_at, SalonRoom.created_at).desc(),
                SalonRoom.created_at.desc(),
            )
            .limit(limit)
            .all()
        )
    except Exception:
        return []

    return [_build_room_dict(r, db) for r in rooms]


# ── Reports ──

@router.post("/reports", response_model=SalonReportSchema, status_code=201)
def create_report(
    report_data: SalonReportCreate,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    report = SalonReport(
        room_id=report_data.room_id,
        post_id=report_data.post_id,
        comment_id=report_data.comment_id,
        reported_by_user_id=current_user.id,
        reason=report_data.reason,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "room_id": report.room_id,
        "post_id": report.post_id,
        "comment_id": report.comment_id,
        "reported_by_user_id": report.reported_by_user_id,
        "reason": report.reason,
        "status": report.status,
        "created_at": report.created_at,
    }


# ── Admin endpoints for new salon features ──

@router.get("/admin/categories")
def admin_list_categories(
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    if current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    cats = db.query(SalonCategory).order_by(SalonCategory.sort_order).all()
    result = []
    for cat in cats:
        room_count = db.query(func.count(SalonRoom.id)).filter(
            SalonRoom.category_id == cat.id,
        ).scalar()
        result.append({
            "id": cat.id,
            "name": cat.name,
            "display_name": cat.display_name,
            "description": cat.description,
            "group_name": cat.group_name,
            "icon": cat.icon,
            "sort_order": cat.sort_order,
            "is_active": cat.is_active,
            "warning_text": cat.warning_text,
            "room_count": room_count or 0,
        })
    return result


@router.put("/admin/categories/{category_id}")
def admin_update_category(
    category_id: int,
    body: dict,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    if current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    cat = db.query(SalonCategory).filter(SalonCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field in ["display_name", "description", "is_active", "sort_order", "warning_text", "icon"]:
        if field in body:
            setattr(cat, field, body[field])
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "display_name": cat.display_name, "is_active": cat.is_active}


@router.put("/admin/rooms/{room_id}/status")
def admin_update_room_status(
    room_id: int,
    body: dict,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    if current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if "status" in body:
        room.status = body["status"]
    if "is_active" in body:
        room.is_active = body["is_active"]
    db.commit()
    return {"id": room.id, "status": room.status, "is_active": room.is_active}


@router.get("/admin/reports")
def admin_list_reports(
    status: str = Query("pending"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    if current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    q = db.query(SalonReport)
    if status:
        q = q.filter(SalonReport.status == status)
    q = q.order_by(SalonReport.created_at.desc())
    total = q.count()
    reports = q.offset((page - 1) * size).limit(size).all()
    items = []
    for r in reports:
        reporter = db.query(User).filter(User.id == r.reported_by_user_id).first()
        items.append({
            "id": r.id,
            "room_id": r.room_id,
            "post_id": r.post_id,
            "comment_id": r.comment_id,
            "reported_by_user_id": r.reported_by_user_id,
            "reporter_name": reporter.display_name if reporter else None,
            "reason": r.reason,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return {"items": items, "total": total}


@router.put("/admin/reports/{report_id}")
def admin_update_report(
    report_id: int,
    body: dict,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    if current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    report = db.query(SalonReport).filter(SalonReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if "status" in body:
        report.status = body["status"]
    db.commit()
    return {"id": report.id, "status": report.status}
