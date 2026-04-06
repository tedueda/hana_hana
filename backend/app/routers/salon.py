from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Profile, MatchingProfile, MatchingProfileImage, SalonRoom, SalonParticipant, SalonMessage
from app.auth import get_current_active_user, get_optional_user
from app.schemas import (
    SalonRoomCreate, SalonRoomUpdate, SalonRoom as SalonRoomSchema,
    SalonParticipantCreate, SalonParticipant as SalonParticipantSchema,
    SalonMessageCreate, SalonMessage as SalonMessageSchema
)

router = APIRouter(prefix="/api/salon", tags=["salon"])

VALID_IDENTITIES = [
    'gay', 'lesbian', 'bisexual', 'transgender', 'questioning', 'other',
    'ゲイ', 'レズビアン', 'バイセクシュアル', 'トランスジェンダー', 'クエスチョニング', 'その他',
    'ALL'
]


def require_premium(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.membership_type != "premium" and current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail={"error": "premium_required", "message": "プレミアム会員のみ利用可能です"})
    return current_user


def get_user_identity(user_id: int, db: Session) -> Optional[str]:
    matching_profile = db.query(MatchingProfile).filter(MatchingProfile.user_id == user_id).first()
    if matching_profile and matching_profile.identity:
        return matching_profile.identity
    return None


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
    return user_identity in target_identities


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
            {"value": "gay", "label": "ゲイ"},
            {"value": "lesbian", "label": "レズビアン"},
            {"value": "bisexual", "label": "バイセクシュアル"},
            {"value": "transgender", "label": "トランスジェンダー"},
            {"value": "questioning", "label": "クエスチョニング"},
            {"value": "other", "label": "その他"},
            {"value": "ALL", "label": "すべて"},
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
