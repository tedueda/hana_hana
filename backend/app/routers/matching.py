from typing import List, Optional, Dict, Set, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import and_, or_, func, select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, MatchingProfile, Hobby, MatchingProfileHobby, MatchingProfileImage, Like, Match, Chat, Message, ChatRequest, ChatRequestMessage
from app.auth import get_current_active_user, get_optional_user
from jose import jwt, JWTError
import os
from datetime import datetime

router = APIRouter(prefix="/api/matching", tags=["matching"])


def require_premium(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.membership_type not in ("premium", "admin", "founder_free"):
        raise HTTPException(status_code=403, detail={"error": "premium_required"})
    return current_user


def _serialize_matching_profile_rows(db: Session, rows: List[Tuple[MatchingProfile, User]]) -> List[dict]:
    """(MatchingProfile, User) の行から、検索／プレビューAPI用の item 配列を組み立てる。"""
    if not rows:
        return []
    user_ids = [prof.user_id for prof, _ in rows]
    main_images: Dict[int, str] = {}
    try:
        subq = (
            db.query(
                MatchingProfileImage.profile_id,
                func.min(MatchingProfileImage.display_order).label("min_order"),
            )
            .filter(MatchingProfileImage.profile_id.in_(user_ids))
            .group_by(MatchingProfileImage.profile_id)
            .subquery()
        )
        images = (
            db.query(MatchingProfileImage)
            .join(
                subq,
                and_(
                    MatchingProfileImage.profile_id == subq.c.profile_id,
                    MatchingProfileImage.display_order == subq.c.min_order,
                ),
            )
            .all()
        )
        main_images = {img.profile_id: img.image_url for img in images}
    except Exception:
        pass

    return [
        {
            "user_id": prof.user_id,
            "display_name": user.display_name or f"User {prof.user_id}",
            "nationality": getattr(prof, "nationality", None) or "",
            "prefecture": prof.prefecture,
            "age_band": prof.age_band,
            "occupation": prof.occupation or "",
            "meet_pref": prof.meet_pref or "",
            "identity": getattr(prof, 'community_category', None) or prof.identity,
            "community_category": getattr(prof, 'community_category', None) or prof.identity or "",
            "position": getattr(prof, 'position', None) or "",
            "romance_targets": prof.romance_targets or [],
            "avatar_url": main_images.get(prof.user_id) or getattr(prof, "avatar_url", None) or "",
            "bio": prof.bio or "",
        }
        for prof, user in rows
    ]


@router.get("/profiles/me")
def get_my_profile(current_user: User = Depends(require_premium), db: Session = Depends(get_db)):
    prof = db.query(MatchingProfile).filter(MatchingProfile.user_id == current_user.id).first()
    if not prof:
        prof = MatchingProfile(user_id=current_user.id)
        db.add(prof)
        db.commit()
        db.refresh(prof)
    hobbies = (
        db.query(Hobby.name)
        .join(MatchingProfileHobby, MatchingProfileHobby.hobby_id == Hobby.id)
        .filter(MatchingProfileHobby.profile_id == current_user.id)
        .all()
    )
    
    # 画像取得（テーブルが存在しない場合はスキップ）
    images = []
    try:
        images = (
            db.query(MatchingProfileImage)
            .filter(MatchingProfileImage.profile_id == current_user.id)
            .order_by(MatchingProfileImage.display_order)
            .all()
        )
    except Exception:
        # matching_profile_images テーブルがまだ存在しない場合
        pass
    
    return {
        "user_id": prof.user_id,
        "nickname": current_user.display_name or "",  # nicknameはdisplay_nameを返す（互換性のため）
        "email": current_user.email or "",
        "display_name": current_user.display_name or "",
        "real_name": getattr(current_user, 'real_name', None) or "",
        "phone_number": getattr(current_user, 'phone_number', None) or "",
        "display_flag": prof.display_flag,
        "nationality": getattr(prof, 'nationality', None) or "",
        "prefecture": prof.prefecture or "",
        "residence_detail": getattr(prof, 'residence_detail', None) or "",
        "hometown": getattr(prof, 'hometown', None) or "",
        "age_band": prof.age_band or "",
        "occupation": prof.occupation or "",
        "income_range": prof.income_range or "",
        "blood_type": getattr(prof, 'blood_type', None) or "",
        "zodiac": getattr(prof, 'zodiac', None) or "",
        "meet_pref": prof.meet_pref or "",
        "meeting_style": getattr(prof, 'meeting_style', None) or prof.meet_pref or "",
        "bio": prof.bio or "",
        "identity": prof.identity or "",
        "avatar_url": getattr(prof, 'avatar_url', None) or "",
        "romance_targets": getattr(prof, 'romance_targets', None) or [],
        "hobbies": [h[0] for h in hobbies],
        "images": [{"id": img.id, "url": img.image_url, "order": img.display_order} for img in images],
    }


@router.put("/profiles/me")
def update_my_profile(payload: dict, current_user: User = Depends(require_premium), db: Session = Depends(get_db)):
    prof = db.query(MatchingProfile).filter(MatchingProfile.user_id == current_user.id).first()
    if not prof:
        prof = MatchingProfile(user_id=current_user.id)
        db.add(prof)
        db.flush()
    # 連絡先NG簡易検知（電話/メールの素朴なパターン）
    bio = payload.get("bio")
    if isinstance(bio, str):
        banned_patterns = ["@", "line:", "LINE:", "+81", "tel:", "電話", "gmail.com", "icloud.com"]
        if any(pat in bio for pat in banned_patterns):
            raise HTTPException(status_code=400, detail="bio contains prohibited contact info")
    
    # バリデーション用の定数（日本語ラベルを受け入れる）
    VALID_AGE_BANDS = ['10s_late', '20s_early', '20s_late', '30s_early', '30s_late', '40s_early', '40s_late', '50s_early', '50s_late', '60s_early', '60s_late', '70plus',
                       '10代', '20代前半', '20代後半', '30代前半', '30代後半', '40代前半', '40代後半', '50代前半', '50代後半', '60代以上']
    VALID_IDENTITIES = ['gay', 'lesbian', 'bisexual', 'transgender', 'questioning', 'other',
                        'ゲイ', 'レズ', 'レズビアン', 'トランスジェンダー', 'バイセクシャル', 'バイセクシュアル', 'クィア', '男性', '女性', '非表示',
                        'ストレート・アライ', 'その他', '非公開']
    VALID_POSITIONS = ['タチ', 'ウケ（ネコ）', 'リバーシブル', '非公開']
    VALID_MEETING_STYLES = ['msg_first', 'voice_after', 'video_after', 'cafe_meal', 'via_hobby', 'meet_if_conditions', 'meet_first', 'online_only']
    
    if "age_band" in payload and payload["age_band"] and payload["age_band"] not in ['', '非表示'] and payload["age_band"] not in VALID_AGE_BANDS:
        raise HTTPException(status_code=422, detail=f"Invalid age_band. Must be one of: {VALID_AGE_BANDS}")
    if "identity" in payload and payload["identity"] and payload["identity"] not in ['', '非表示'] and payload["identity"] not in VALID_IDENTITIES:
        raise HTTPException(status_code=422, detail=f"Invalid identity. Must be one of: {VALID_IDENTITIES}")
    if "community_category" in payload and payload["community_category"] and payload["community_category"] not in ['', '非公開'] and payload["community_category"] not in VALID_IDENTITIES:
        raise HTTPException(status_code=422, detail=f"Invalid community_category. Must be one of: {VALID_IDENTITIES}")
    if "position" in payload and payload["position"] and payload["position"] not in ['', '非公開'] and payload["position"] not in VALID_POSITIONS:
        raise HTTPException(status_code=422, detail=f"Invalid position. Must be one of: {VALID_POSITIONS}")
    if "meeting_style" in payload and payload["meeting_style"] and payload["meeting_style"] not in ['', '非表示'] and payload["meeting_style"] not in VALID_MEETING_STYLES:
        raise HTTPException(status_code=422, detail=f"Invalid meeting_style. Must be one of: {VALID_MEETING_STYLES}")
    
    # Userテーブルのフィールド更新
    if "email" in payload:
        current_user.email = payload["email"]
    if "display_name" in payload:
        current_user.display_name = payload["display_name"]
    if "nickname" in payload:
        # nicknameはdisplay_nameとして扱う
        current_user.display_name = payload["nickname"]
    if "real_name" in payload:
        current_user.real_name = payload["real_name"]
    if "password" in payload and payload["password"]:
        from app.auth import get_password_hash
        current_user.hashed_password = get_password_hash(payload["password"])
    
    # フィールド更新（カラムが存在しない場合はスキップ）
    # nicknameは除外（display_nameを使用）
    for field in ["nationality", "prefecture", "residence_detail", "hometown", "age_band", "occupation", "income_range", "blood_type", "zodiac", "meet_pref", "bio", "identity"]:
        if field in payload and hasattr(prof, field):
            setattr(prof, field, payload.get(field))
    
    # 新しいカラム（マイグレーション後のみ）
    for field in ["meeting_style", "avatar_url", "romance_targets", "community_category", "position"]:
        if field in payload and hasattr(prof, field):
            setattr(prof, field, payload.get(field))
    # community_category が設定された場合、後方互換性のため identity にも同じ値をセット
    if "community_category" in payload and hasattr(prof, 'community_category'):
        prof.identity = payload["community_category"]
    # hobbies
    if "hobbies" in payload and isinstance(payload["hobbies"], list):
        # 現在の関連を全削除→再作成
        db.query(MatchingProfileHobby).filter(MatchingProfileHobby.profile_id == current_user.id).delete()
        names = [str(n).strip() for n in payload["hobbies"] if str(n).strip()]
        if names:
            # 既存/新規を混在で対応
            existing = db.query(Hobby).filter(Hobby.name.in_(names)).all()
            existing_names = {h.name for h in existing}
            for nm in names:
                if nm not in existing_names:
                    h = Hobby(name=nm)
                    db.add(h)
                    db.flush()
                    existing.append(h)
            for h in existing:
                db.add(MatchingProfileHobby(profile_id=current_user.id, hobby_id=h.id))
    db.commit()
    return {"status": "ok"}


@router.put("/profiles/me/visibility")
def update_visibility(display_flag: bool, current_user: User = Depends(require_premium), db: Session = Depends(get_db)):
    prof = db.query(MatchingProfile).filter(MatchingProfile.user_id == current_user.id).first()
    if not prof:
        prof = MatchingProfile(user_id=current_user.id)
        db.add(prof)
    prof.display_flag = bool(display_flag)
    db.commit()
    return {"status": "ok", "display_flag": prof.display_flag}


@router.get("/profiles/{user_id}")
def get_profile_by_id(
    user_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    prof = db.query(MatchingProfile).filter(MatchingProfile.user_id == user_id).first()
    if not prof or not prof.display_flag:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hobbies = (
        db.query(Hobby.name)
        .join(MatchingProfileHobby, MatchingProfileHobby.hobby_id == Hobby.id)
        .filter(MatchingProfileHobby.profile_id == user_id)
        .all()
    )
    
    images = []
    try:
        images = (
            db.query(MatchingProfileImage)
            .filter(MatchingProfileImage.profile_id == user_id)
            .order_by(MatchingProfileImage.display_order)
            .all()
        )
    except Exception:
        pass
    
    return {
        "user_id": prof.user_id,
        "nickname": getattr(prof, 'nickname', None) or "",
        "display_name": user.display_name,
        "display_flag": prof.display_flag,
        "nationality": getattr(prof, 'nationality', None) or "",
        "prefecture": prof.prefecture or "",
        "residence_detail": getattr(prof, 'residence_detail', None) or "",
        "age_band": prof.age_band or "",
        "occupation": prof.occupation or "",
        "income_range": prof.income_range or "",
        "blood_type": getattr(prof, 'blood_type', None) or "",
        "zodiac": getattr(prof, 'zodiac', None) or "",
        "meet_pref": prof.meet_pref or "",
        "meeting_style": getattr(prof, 'meeting_style', None) or prof.meet_pref or "",
        "bio": prof.bio or "",
        "identity": prof.identity or "",
        "avatar_url": getattr(prof, 'avatar_url', None) or "",
        "romance_targets": prof.romance_targets or [],
        "hobbies": [h[0] for h in hobbies],
        "images": [{"id": img.id, "url": img.image_url, "order": img.display_order} for img in images],
    }


@router.get("/search")
def search_profiles(
    prefecture: Optional[str] = Query(None),
    age_band: Optional[str] = Query(None),
    occupation: Optional[str] = Query(None),
    income_range: Optional[str] = Query(None),
    hobbies: Optional[str] = Query(None, description="comma separated"),
    meet_pref: Optional[str] = Query(None),
    identity: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    q = db.query(MatchingProfile, User).join(User, User.id == MatchingProfile.user_id)
    q = q.filter(MatchingProfile.display_flag == True)
    if current_user:
        q = q.filter(MatchingProfile.user_id != current_user.id)
    if prefecture:
        q = q.filter(MatchingProfile.prefecture == prefecture)
    if age_band:
        q = q.filter(MatchingProfile.age_band == age_band)
    if occupation:
        q = q.filter(MatchingProfile.occupation == occupation)
    if income_range:
        q = q.filter(MatchingProfile.income_range == income_range)
    if meet_pref:
        q = q.filter(MatchingProfile.meet_pref == meet_pref)
    if identity:
        q = q.filter(MatchingProfile.identity == identity)
    if hobbies:
        names = [s.strip() for s in hobbies.split(",") if s.strip()]
        if names:
            q = (
                q.join(MatchingProfileHobby, MatchingProfileHobby.profile_id == MatchingProfile.user_id)
                 .join(Hobby, Hobby.id == MatchingProfileHobby.hobby_id)
                 .filter(Hobby.name.in_(names))
            )
    total = q.count()
    rows = q.offset((page - 1) * size).limit(size).all()
    items = _serialize_matching_profile_rows(db, rows)
    return {"items": items, "page": page, "size": size, "count": total}


@router.get("/public-preview")
def public_matching_preview(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    掲載中（display_flag=True）のマッチングプロフィール一覧。
    About ページの会員マッチング等で、未ログイン・非有料でも本番DBのプレビューを表示するための公開エンドポイント。
    ログイン時は自分自身を一覧から除外する。
    """
    q = db.query(MatchingProfile, User).join(User, User.id == MatchingProfile.user_id)
    q = q.filter(MatchingProfile.display_flag == True)
    if current_user is not None:
        q = q.filter(MatchingProfile.user_id != current_user.id)
    total = q.count()
    rows = q.offset((page - 1) * size).limit(size).all()
    items = _serialize_matching_profile_rows(db, rows)
    return {"items": items, "page": page, "size": size, "count": total}


@router.post("/likes/{to_user_id}", status_code=201)
def like_user(
    to_user_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    if to_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="cannot like yourself")
    # 既存のlike
    like = (
        db.query(Like)
        .filter(Like.from_user_id == current_user.id, Like.to_user_id == to_user_id)
        .first()
    )
    if not like:
        like = Like(from_user_id=current_user.id, to_user_id=to_user_id, status="active")
        db.add(like)
        db.flush()
    else:
        like.status = "active"
    db.commit()
    return {"status": "liked", "like_id": like.id}


@router.get("/likes")
def list_likes(
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """自分が送ったいいね一覧を取得"""
    likes = (
        db.query(Like)
        .filter(Like.from_user_id == current_user.id, Like.status == "active")
        .all()
    )
    items = []
    for like in likes:
        other = db.query(User).filter(User.id == like.to_user_id).first()
        prof = db.query(MatchingProfile).filter(MatchingProfile.user_id == like.to_user_id).first()
        
        # プロフィール画像を取得（最初の画像のみ）
        profile_image = None
        try:
            first_image = (
                db.query(MatchingProfileImage)
                .filter(MatchingProfileImage.profile_id == like.to_user_id)
                .order_by(MatchingProfileImage.display_order)
                .first()
            )
            if first_image:
                profile_image = first_image.image_url
        except Exception as e:
            # テーブルが存在しない場合やエラーはスキップ
            print(f"Error fetching profile image: {e}")
            pass
        
        # プロフィール画像がない場合はavatar_urlを使用
        avatar_url = profile_image or (getattr(prof, 'avatar_url', None) if prof else None)
        
        # display_nameを使用
        display_name = other.display_name if other else f"User {like.to_user_id}"
        
        items.append({
            "like_id": like.id,
            "user_id": like.to_user_id,
            "display_name": display_name,
            "identity": prof.identity if prof else None,
            "prefecture": prof.prefecture if prof else None,
            "age_band": prof.age_band if prof else None,
            "avatar_url": avatar_url,
        })
    return {"items": items}


@router.get("/matches")
def list_matches(
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    ms = (
        db.query(Match)
        .filter(or_(Match.user_a_id == current_user.id, Match.user_b_id == current_user.id))
        .all()
    )
    items = []
    for m in ms:
        other_id = m.user_b_id if m.user_a_id == current_user.id else m.user_a_id
        other = db.query(User).filter(User.id == other_id).first()
        # display_nameを使用
        display_name = other.display_name if other else f"User {other_id}"
        items.append({"match_id": m.id, "user_id": other_id, "display_name": display_name})
    return {"items": items}


@router.post("/ensure_chat/{to_user_id}")
def ensure_chat(
    to_user_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """チャットを開始（承諾済みのリクエストが必要）"""
    if to_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself")
    
    # 承諾済みのチャットリクエストをチェック
    accepted_request = (
        db.query(ChatRequest)
        .filter(
            or_(
                (ChatRequest.from_user_id == current_user.id) & (ChatRequest.to_user_id == to_user_id),
                (ChatRequest.from_user_id == to_user_id) & (ChatRequest.to_user_id == current_user.id)
            ),
            ChatRequest.status == "accepted"
        )
        .first()
    )
    
    if not accepted_request:
        raise HTTPException(status_code=404, detail="No accepted chat request found. Please send a chat request first.")
    
    a, b = sorted([current_user.id, to_user_id])
    match = (
        db.query(Match)
        .filter(Match.user_a_id == a, Match.user_b_id == b)
        .first()
    )
    
    if not match:
        raise HTTPException(status_code=404, detail="No match found")
    
    chat = db.query(Chat).filter(Chat.match_id == match.id).first()
    if not chat:
        chat = Chat(match_id=match.id)
        db.add(chat)
        db.commit()
        db.refresh(chat)
    
    return {"chat_id": chat.id}


@router.get("/chats")
def list_chats(
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    ms = (
        db.query(Match)
        .filter(or_(Match.user_a_id == current_user.id, Match.user_b_id == current_user.id))
        .all()
    )
    chat_items = []
    for m in ms:
        ch = db.query(Chat).filter(Chat.match_id == m.id).first()
        if not ch:
            ch = Chat(match_id=m.id)
            db.add(ch)
            db.flush()
        other_id = m.user_b_id if m.user_a_id == current_user.id else m.user_a_id
        other = db.query(User).filter(User.id == other_id).first()
        other_profile = db.query(MatchingProfile).filter(MatchingProfile.user_id == other_id).first()
        last_msg = (
            db.query(Message).filter(Message.chat_id == ch.id).order_by(Message.created_at.desc()).first()
        )
        
        profile_images = (
            db.query(MatchingProfileImage)
            .filter(MatchingProfileImage.profile_id == other_id)
            .order_by(MatchingProfileImage.display_order)
            .all()
        )
        avatar_url = profile_images[0].image_url if profile_images else None
        
        # display_nameを使用
        display_name = other.display_name if other else f"User {other_id}"
        
        # 未読メッセージ数を計算
        unread_count = (
            db.query(Message)
            .filter(Message.chat_id == ch.id, Message.sender_id == other_id, Message.read_at == None)
            .count()
        )
        
        chat_items.append({
            "chat_id": ch.id,
            "with_user_id": other_id,
            "with_display_name": display_name,
            "with_avatar_url": avatar_url,
            "last_message": last_msg.body if last_msg else None,
            "last_message_at": last_msg.created_at.isoformat() if last_msg and last_msg.created_at else None,
            "unread_count": unread_count,
        })
    return {"items": chat_items}


def _ensure_chat_access(chat_id: int, user_id: int, db: Session) -> Chat:
    ch = db.query(Chat).filter(Chat.id == chat_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="chat not found")
    m = db.query(Match).filter(Match.id == ch.match_id).first()
    if not m or (m.user_a_id != user_id and m.user_b_id != user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    return ch


@router.get("/chats/{chat_id}/messages")
def get_messages(
    chat_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    ch = _ensure_chat_access(chat_id, current_user.id, db)
    msgs = db.query(Message).filter(Message.chat_id == ch.id).order_by(Message.created_at.asc()).all()
    return {"items": [
        {
            "id": m.id,
            "chat_id": m.chat_id,
            "sender_id": m.sender_id,
            "body": m.body,
            "image_url": None,
            "created_at": m.created_at.isoformat() if m.created_at else None
        } for m in msgs
    ]}


@router.post("/chats/{chat_id}/messages", status_code=201)
def send_message(
    chat_id: int,
    payload: dict,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    ch = _ensure_chat_access(chat_id, current_user.id, db)
    body = (payload or {}).get("body")
    
    body_text = str(body).strip() if body else None
    
    if not body_text:
        raise HTTPException(status_code=400, detail="Body is required")
    
    msg = Message(chat_id=ch.id, sender_id=current_user.id, body=body_text)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id,
        "chat_id": msg.chat_id,
        "sender_id": msg.sender_id,
        "body": msg.body,
        "image_url": None,
        "created_at": msg.created_at.isoformat() if msg.created_at else None
    }


@router.post("/chats/{chat_id}/read")
def mark_messages_as_read(
    chat_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """チャットのメッセージを既読にする"""
    from datetime import datetime
    
    ch = _ensure_chat_access(chat_id, current_user.id, db)
    m = db.query(Match).filter(Match.id == ch.match_id).first()
    other_id = m.user_b_id if m.user_a_id == current_user.id else m.user_a_id
    
    # 相手からのメッセージを既読にする
    updated = (
        db.query(Message)
        .filter(
            Message.chat_id == chat_id,
            Message.sender_id == other_id,
            Message.read_at == None
        )
        .update({"read_at": datetime.utcnow()})
    )
    db.commit()
    
    return {"marked_as_read": updated}


# ===== WebSocket (simple in-process pub/sub) =====
WS_SECRET = os.getenv("SECRET_KEY", "your-secret-key-here")
WS_ALG = os.getenv("ALGORITHM", "HS256")
chat_connections: Dict[int, Set[WebSocket]] = {}


@router.websocket("/ws/matching/chat")
async def ws_chat(websocket: WebSocket):
    # Expect query: ?chat_id=...&token=...
    params = dict(websocket.query_params)
    chat_id_raw = params.get("chat_id")
    token = params.get("token")
    if not chat_id_raw or not token:
        await websocket.close(code=1008)
        return
    try:
        chat_id = int(chat_id_raw)
    except ValueError:
        await websocket.close(code=1008)
        return

    # Authn: decode JWT
    try:
        payload = jwt.decode(token, WS_SECRET, algorithms=[WS_ALG])
        email = payload.get("sub")
        if not email:
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return

    # Authz: user has access to chat
    with next(get_db()) as db:
        user: User = db.query(User).filter(User.email == email).first()
        if not user:
            await websocket.close(code=1008)
            return
        try:
            _ensure_chat_access(chat_id, user.id, db)
        except HTTPException:
            await websocket.close(code=1008)
            return

    await websocket.accept()
    chat_connections.setdefault(chat_id, set()).add(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            body = str(data.get("body", "")).strip()
            if not body:
                continue
            # Persist message
            with next(get_db()) as db:
                ch = _ensure_chat_access(chat_id, user.id, db)
                msg = Message(chat_id=chat_id, sender_id=user.id, body=body)
                db.add(msg)
                db.commit()
                db.refresh(msg)
                payload = {
                    "id": msg.id,
                    "chat_id": msg.chat_id,
                    "sender_id": msg.sender_id,
                    "body": msg.body,
                    "created_at": msg.created_at.isoformat() if hasattr(msg.created_at, 'isoformat') else str(msg.created_at),
                }
            # Broadcast to all connections in this chat
            living: Set[WebSocket] = set()
            for ws in chat_connections.get(chat_id, set()):
                try:
                    await ws.send_json(payload)
                    living.add(ws)
                except Exception:
                    # drop dead connection
                    pass
            chat_connections[chat_id] = living
    except WebSocketDisconnect:
        pass
    finally:
        try:
            chat_connections.get(chat_id, set()).discard(websocket)
        except Exception:
            pass


# ===== プロフィール画像管理 =====

@router.post("/profiles/me/images")
def add_profile_image(payload: dict, current_user: User = Depends(require_premium), db: Session = Depends(get_db)):
    """プロフィール画像を追加（最大5枚）"""
    try:
        image_url = payload.get("image_url")
        if not image_url:
            raise HTTPException(status_code=400, detail="image_url is required")
        
        # 現在の画像数を確認
        count = db.query(MatchingProfileImage).filter(MatchingProfileImage.profile_id == current_user.id).count()
        if count >= 5:
            raise HTTPException(status_code=400, detail="Maximum 5 images allowed")
        
        # 次の display_order を決定
        max_order = db.query(func.max(MatchingProfileImage.display_order)).filter(
            MatchingProfileImage.profile_id == current_user.id
        ).scalar()
        next_order = (max_order + 1) if max_order is not None else 0
        
        img = MatchingProfileImage(
            profile_id=current_user.id,
            image_url=image_url,
            display_order=next_order
        )
        db.add(img)
        db.commit()
        db.refresh(img)
        return {"id": img.id, "url": img.image_url, "order": img.display_order}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image table not ready. Please run migration first: {str(e)}")


@router.delete("/profiles/me/images/{image_id}")
def delete_profile_image(image_id: int, current_user: User = Depends(require_premium), db: Session = Depends(get_db)):
    """プロフィール画像を削除"""
    try:
        img = db.query(MatchingProfileImage).filter(
            MatchingProfileImage.id == image_id,
            MatchingProfileImage.profile_id == current_user.id
        ).first()
        if not img:
            raise HTTPException(status_code=404, detail="Image not found")
        
        db.delete(img)
        db.commit()
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image table not ready. Please run migration first: {str(e)}")


@router.put("/profiles/me/images/reorder")
def reorder_profile_images(payload: dict, current_user: User = Depends(require_premium), db: Session = Depends(get_db)):
    """プロフィール画像の順序を変更"""
    try:
        image_ids = payload.get("image_ids", [])
        if not isinstance(image_ids, list) or len(image_ids) > 5:
            raise HTTPException(status_code=400, detail="Invalid image_ids")
        
        for idx, img_id in enumerate(image_ids):
            img = db.query(MatchingProfileImage).filter(
                MatchingProfileImage.id == img_id,
                MatchingProfileImage.profile_id == current_user.id
            ).first()
            if img:
                img.display_order = idx
        
        db.commit()
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image table not ready. Please run migration first: {str(e)}")


# ===== チャットリクエスト機能 =====

@router.post("/chat_requests/{to_user_id}", status_code=201)
def send_chat_request(
    to_user_id: int,
    payload: dict,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """チャットリクエストを送信"""
    if to_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send chat request to yourself")
    
    # 既存のpendingリクエストをチェック
    existing_pending = (
        db.query(ChatRequest)
        .filter(
            ChatRequest.from_user_id == current_user.id,
            ChatRequest.to_user_id == to_user_id,
            ChatRequest.status == "pending"
        )
        .first()
    )
    
    if existing_pending:
        return {"request_id": existing_pending.id, "status": "pending", "message": "Request already sent"}
    
    a, b = sorted([current_user.id, to_user_id])
    existing_match = (
        db.query(Match)
        .filter(Match.user_a_id == a, Match.user_b_id == b)
        .first()
    )
    
    if existing_match:
        existing_chat = db.query(Chat).filter(Chat.match_id == existing_match.id).first()
        if existing_chat:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "already_chatting",
                    "chat_id": existing_chat.id,
                    "message": "Chat already exists with this user"
                }
            )
    
    # 新しいリクエストを作成
    initial_message = payload.get("initial_message", "")
    request = ChatRequest(
        from_user_id=current_user.id,
        to_user_id=to_user_id,
        status="pending",
        initial_message=initial_message if initial_message else None
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    
    return {"request_id": request.id, "status": "pending", "message": "Chat request sent"}


@router.get("/chat_requests/incoming")
def list_incoming_chat_requests(
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """受信したチャットリクエスト一覧"""
    requests = (
        db.query(ChatRequest)
        .filter(ChatRequest.to_user_id == current_user.id, ChatRequest.status == "pending")
        .all()
    )
    
    items = []
    for req in requests:
        from_user = db.query(User).filter(User.id == req.from_user_id).first()
        profile = db.query(MatchingProfile).filter(MatchingProfile.user_id == req.from_user_id).first()
        
        images = (
            db.query(MatchingProfileImage)
            .filter(MatchingProfileImage.profile_id == req.from_user_id)
            .order_by(MatchingProfileImage.display_order)
            .all()
        )
        avatar_url = images[0].image_url if images else None
        
        items.append({
            "request_id": req.id,
            "from_user_id": req.from_user_id,
            "from_display_name": (profile.nickname if (profile and profile.nickname) else (from_user.display_name if from_user else f"User {req.from_user_id}")),

            "from_avatar_url": avatar_url,
            "identity": profile.identity if profile else None,
            "prefecture": profile.prefecture if profile else None,
            "age_band": profile.age_band if profile else None,
            "initial_message": req.initial_message,
            "created_at": req.created_at.isoformat() if req.created_at else None,
        })
    
    return {"items": items}


@router.get("/chat_requests/outgoing")
def list_outgoing_chat_requests(
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """送信したチャットリクエスト一覧（pending のみ）"""
    requests = (
        db.query(ChatRequest)
        .filter(
            ChatRequest.from_user_id == current_user.id,
            ChatRequest.status == "pending"
        )
        .order_by(ChatRequest.created_at.desc())
        .all()
    )
    
    items = []
    for req in requests:
        to_user = db.query(User).filter(User.id == req.to_user_id).first()
        profile = db.query(MatchingProfile).filter(MatchingProfile.user_id == req.to_user_id).first()
        
        images = (
            db.query(MatchingProfileImage)
            .filter(MatchingProfileImage.profile_id == req.to_user_id)
            .order_by(MatchingProfileImage.display_order)
            .all()
        )
        avatar_url = images[0].image_url if images else None
        
        items.append({
            "request_id": req.id,
            "from_user_id": req.from_user_id,
            "to_user_id": req.to_user_id,
            "to_display_name": (profile.nickname if (profile and profile.nickname) else (to_user.display_name if to_user else f"User {req.to_user_id}")),

            "to_avatar_url": avatar_url,
            "identity": profile.identity if profile else None,
            "prefecture": profile.prefecture if profile else None,
            "age_band": profile.age_band if profile else None,
            "initial_message": req.initial_message,
            "status": req.status,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "responded_at": req.responded_at.isoformat() if req.responded_at else None,
        })
    
    return {"items": items}


@router.post("/chat_requests/{request_id}/accept")
def accept_chat_request(
    request_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """チャットリクエストを承諾"""
    request = db.query(ChatRequest).filter(ChatRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Chat request not found")
    
    if request.to_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request to accept")
    
    if request.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {request.status}")
    
    # リクエストを承諾
    request.status = "accepted"
    request.responded_at = datetime.utcnow()
    
    # Matchを作成（まだ存在しない場合）
    a, b = sorted([request.from_user_id, request.to_user_id])
    existing_match = (
        db.query(Match)
        .filter(Match.user_a_id == a, Match.user_b_id == b)
        .first()
    )
    
    if not existing_match:
        match = Match(user_a_id=a, user_b_id=b, active_flag=True)
        db.add(match)
        db.flush()
        match_id = match.id
    else:
        match_id = existing_match.id
    
    # Chatを作成（まだ存在しない場合）
    existing_chat = db.query(Chat).filter(Chat.match_id == match_id).first()
    if not existing_chat:
        chat = Chat(match_id=match_id)
        db.add(chat)
        db.flush()
        chat_id = chat.id
    else:
        chat_id = existing_chat.id
    
    other_pending_requests = (
        db.query(ChatRequest)
        .filter(
            ChatRequest.id != request_id,
            ChatRequest.status == "pending",
            or_(
                and_(ChatRequest.from_user_id == request.from_user_id, ChatRequest.to_user_id == request.to_user_id),
                and_(ChatRequest.from_user_id == request.to_user_id, ChatRequest.to_user_id == request.from_user_id)
            )
        )
        .all()
    )
    
    for other_req in other_pending_requests:
        other_req.status = "declined"
        other_req.responded_at = datetime.utcnow()
    
    pending_messages = (
        db.query(ChatRequestMessage)
        .filter(
            ChatRequestMessage.chat_request_id == request_id,
            ChatRequestMessage.migrated_at.is_(None)
        )
        .order_by(ChatRequestMessage.created_at)
        .all()
    )
    
    for pm in pending_messages:
        existing_msg = (
            db.query(Message)
            .filter(
                Message.chat_id == chat_id,
                Message.sender_id == pm.from_user_id,
                Message.body == pm.content,
                Message.created_at == pm.created_at
            )
            .first()
        )
        
        if not existing_msg:
            msg = Message(
                chat_id=chat_id,
                sender_id=pm.from_user_id,
                body=pm.content,
                created_at=pm.created_at
            )
            db.add(msg)
        
        pm.migrated_at = datetime.utcnow()
    
    db.commit()
    
    return {"status": "accepted", "chat_id": chat_id, "match_id": match_id}


@router.post("/chat_requests/{request_id}/decline")
def decline_chat_request(
    request_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """チャットリクエストを辞退"""
    request = db.query(ChatRequest).filter(ChatRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Chat request not found")
    
    if request.to_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request to decline")
    
    if request.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {request.status}")
    
    # リクエストを辞退
    request.status = "declined"
    request.responded_at = datetime.utcnow()
    db.commit()
    
    return {"status": "declined"}


@router.post("/chat_requests/{request_id}/messages")
def send_pending_message(
    request_id: int,
    body: dict,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """承諾前のメッセージを送信（送信者のみ）"""
    request = db.query(ChatRequest).filter(ChatRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Chat request not found")
    
    if request.from_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only sender can send pending messages")
    
    if request.status == "accepted":
        raise HTTPException(status_code=400, detail="Request already accepted, use regular chat")
    
    if request.status == "declined":
        raise HTTPException(status_code=400, detail="Request was declined")
    
    content = body.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content is required")
    
    msg = ChatRequestMessage(
        chat_request_id=request_id,
        from_user_id=current_user.id,
        content=content
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    
    return {
        "id": msg.id,
        "chat_request_id": msg.chat_request_id,
        "from_user_id": msg.from_user_id,
        "content": msg.content,
        "created_at": msg.created_at.isoformat() if msg.created_at else None
    }


@router.get("/chat_requests/{request_id}/messages")
def get_pending_messages(
    request_id: int,
    current_user: User = Depends(require_premium),
    db: Session = Depends(get_db),
):
    """承諾前のメッセージを取得"""
    request = db.query(ChatRequest).filter(ChatRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Chat request not found")
    
    if request.from_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only sender can view pending messages")
    
    messages = (
        db.query(ChatRequestMessage)
        .filter(ChatRequestMessage.chat_request_id == request_id)
        .order_by(ChatRequestMessage.created_at)
        .all()
    )
    
    return {
        "messages": [
            {
                "id": msg.id,
                "from_user_id": msg.from_user_id,
                "content": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
                "migrated": msg.migrated_at is not None
            }
            for msg in messages
        ]
    }
