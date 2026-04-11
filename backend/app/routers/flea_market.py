from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List, Optional
from app.database import get_db
from app.auth import get_current_user, get_current_active_user, get_optional_user
from app import models, schemas

router = APIRouter(prefix="/api/flea-market", tags=["flea-market"])


def require_premium(current_user: models.User = Depends(get_current_active_user)) -> models.User:
    if current_user.membership_type not in ("premium", "admin", "founder_free"):
        raise HTTPException(status_code=403, detail={"error": "premium_required"})
    return current_user

# Flea market categories
FLEA_MARKET_CATEGORIES = [
    "electronics",      # 家電・スマホ・カメラ
    "fashion",          # ファッション
    "furniture",        # 家具・インテリア
    "hobby",            # ホビー・楽器・アート
    "books",            # 本・音楽・ゲーム
    "sports",           # スポーツ・レジャー
    "beauty",           # コスメ・美容
    "handmade",         # ハンドメイド
    "other",            # その他
]

# Japanese prefectures for region filter
PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
    "岐阜県", "静岡県", "愛知県", "三重県",
    "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
    "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県",
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]


@router.get("/categories")
def get_categories():
    """Get available flea market categories"""
    return FLEA_MARKET_CATEGORIES


@router.get("/prefectures")
def get_prefectures():
    """Get available prefectures for region filter"""
    return PREFECTURES


@router.get("/items", response_model=List[schemas.FleaMarketItem])
def list_items(
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    region: Optional[str] = None,
    sort: str = Query("newest", regex="^(newest|price_asc|price_desc|negotiable)$"),
    status: str = Query("active", regex="^(active|sold|all)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_premium),
):
    """List flea market items with filters and sorting"""
    query = db.query(models.FleaMarketItem)
    
    # Filter by status
    if status == "active":
        query = query.filter(models.FleaMarketItem.status == "active")
    elif status == "sold":
        query = query.filter(models.FleaMarketItem.status == "sold")
    # "all" shows everything
    
    # Filter by keyword (search in title and description)
    if keyword:
        search_term = f"%{keyword}%"
        query = query.filter(
            (models.FleaMarketItem.title.ilike(search_term)) |
            (models.FleaMarketItem.description.ilike(search_term))
        )
    
    # Filter by category
    if category:
        query = query.filter(models.FleaMarketItem.category == category)
    
    # Filter by region
    if region:
        query = query.filter(models.FleaMarketItem.region == region)
    
    # Sorting
    if sort == "newest":
        query = query.order_by(desc(models.FleaMarketItem.created_at))
    elif sort == "price_asc":
        query = query.order_by(asc(models.FleaMarketItem.price))
    elif sort == "price_desc":
        query = query.order_by(desc(models.FleaMarketItem.price))
    elif sort == "negotiable":
        # Show negotiable items first, then by date
        query = query.order_by(
            desc(models.FleaMarketItem.transaction_method == "negotiable"),
            desc(models.FleaMarketItem.created_at)
        )
    
    # Pagination
    items = query.offset(offset).limit(limit).all()
    
    # Enrich with user info
    result = []
    for item in items:
        user = db.query(models.User).filter(models.User.id == item.seller_id).first()
        profile = db.query(models.Profile).filter(models.Profile.user_id == item.seller_id).first()
        
        item_dict = {
            "id": item.id,
            "user_id": item.seller_id,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "category": item.category,
            "region": item.region,
            "transaction_method": item.transaction_method,
            "status": item.status,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "images": [{"id": img.id, "image_url": img.image_url, "display_order": img.display_order} for img in item.images],
            "user_display_name": user.display_name if user else None,
            "user_avatar_url": profile.avatar_url if profile else None,
        }
        result.append(item_dict)
    
    return result


@router.get("/items/{item_id}", response_model=schemas.FleaMarketItem)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_premium),
):
    """Get a single flea market item by ID"""
    item = db.query(models.FleaMarketItem).filter(models.FleaMarketItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    user = db.query(models.User).filter(models.User.id == item.seller_id).first()
    profile = db.query(models.Profile).filter(models.Profile.user_id == item.seller_id).first()
    
    return {
        "id": item.id,
        "user_id": item.seller_id,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "category": item.category,
        "region": item.region,
        "transaction_method": item.transaction_method,
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "images": [{"id": img.id, "image_url": img.image_url, "display_order": img.display_order} for img in item.images],
        "user_display_name": user.display_name if user else None,
        "user_avatar_url": profile.avatar_url if profile else None,
    }


@router.post("/items", response_model=schemas.FleaMarketItem)
def create_item(
    item_data: schemas.FleaMarketItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new flea market item (premium members only)"""
    # Check if user is premium
    if current_user.membership_type not in ["premium", "admin", "founder_free"]:
        raise HTTPException(
            status_code=403,
            detail="Premium membership required to post items"
        )
    
    # Create the item
    item = models.FleaMarketItem(
        seller_id=current_user.id,
        title=item_data.title,
        description=item_data.description,
        price=item_data.price,
        category=item_data.category,
        region=item_data.region,
        transaction_method=item_data.transaction_method,
        status="active",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Add images if provided
    if item_data.image_urls:
        for i, url in enumerate(item_data.image_urls[:5]):  # Max 5 images
            image = models.FleaMarketItemImage(
                item_id=item.id,
                image_url=url,
                display_order=i,
            )
            db.add(image)
        db.commit()
        db.refresh(item)
    
    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.id).first()
    
    return {
        "id": item.id,
        "user_id": item.seller_id,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "category": item.category,
        "region": item.region,
        "transaction_method": item.transaction_method,
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "images": [{"id": img.id, "image_url": img.image_url, "display_order": img.display_order} for img in item.images],
        "user_display_name": current_user.display_name,
        "user_avatar_url": profile.avatar_url if profile else None,
    }


@router.put("/items/{item_id}", response_model=schemas.FleaMarketItem)
def update_item(
    item_id: int,
    item_data: schemas.FleaMarketItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update a flea market item (owner only)"""
    item = db.query(models.FleaMarketItem).filter(models.FleaMarketItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.seller_id != current_user.id and current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to update this item")
    
    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)
    image_urls = update_data.pop("image_urls", None)
    
    for field, value in update_data.items():
        setattr(item, field, value)
    
    # Update images if provided
    if image_urls is not None:
        # Delete existing images
        db.query(models.FleaMarketItemImage).filter(
            models.FleaMarketItemImage.item_id == item_id
        ).delete()
        
        # Add new images
        for i, url in enumerate(image_urls[:5]):
            image = models.FleaMarketItemImage(
                item_id=item.id,
                image_url=url,
                display_order=i,
            )
            db.add(image)
    
    db.commit()
    db.refresh(item)
    
    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.id).first()
    
    return {
        "id": item.id,
        "user_id": item.seller_id,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "category": item.category,
        "region": item.region,
        "transaction_method": item.transaction_method,
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "images": [{"id": img.id, "image_url": img.image_url, "display_order": img.display_order} for img in item.images],
        "user_display_name": current_user.display_name,
        "user_avatar_url": profile.avatar_url if profile else None,
    }


@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete a flea market item (owner only)"""
    item = db.query(models.FleaMarketItem).filter(models.FleaMarketItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.seller_id != current_user.id and current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this item")
    
    # Delete images first
    db.query(models.FleaMarketItemImage).filter(
        models.FleaMarketItemImage.item_id == item_id
    ).delete()
    
    # Delete chats and messages
    chats = db.query(models.FleaMarketChat).filter(models.FleaMarketChat.item_id == item_id).all()
    for chat in chats:
        db.query(models.FleaMarketMessage).filter(models.FleaMarketMessage.chat_id == chat.id).delete()
    db.query(models.FleaMarketChat).filter(models.FleaMarketChat.item_id == item_id).delete()
    
    # Delete the item
    db.delete(item)
    db.commit()
    
    return {"message": "Item deleted successfully"}


# Chat endpoints

@router.post("/chats", response_model=schemas.FleaMarketChat)
def create_chat(
    chat_data: schemas.FleaMarketChatCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Start a chat about an item (premium members only)"""
    # Check if user is premium
    if current_user.membership_type not in ["premium", "admin", "founder_free"]:
        raise HTTPException(
            status_code=403,
            detail="Premium membership required to contact sellers"
        )
    
    # Get the item
    item = db.query(models.FleaMarketItem).filter(models.FleaMarketItem.id == chat_data.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Can't chat with yourself
    if item.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start a chat about your own item")
    
    # Check if chat already exists
    existing_chat = db.query(models.FleaMarketChat).filter(
        models.FleaMarketChat.item_id == chat_data.item_id,
        models.FleaMarketChat.buyer_id == current_user.id,
    ).first()
    
    if existing_chat:
        # Return existing chat
        buyer = db.query(models.User).filter(models.User.id == existing_chat.buyer_id).first()
        seller = db.query(models.User).filter(models.User.id == existing_chat.seller_id).first()
        return {
            "id": existing_chat.id,
            "item_id": existing_chat.item_id,
            "buyer_id": existing_chat.buyer_id,
            "seller_id": existing_chat.seller_id,
            "status": existing_chat.status,
            "created_at": existing_chat.created_at,
            "updated_at": existing_chat.updated_at,
            "item_title": item.title,
            "buyer_display_name": buyer.display_name if buyer else None,
            "seller_display_name": seller.display_name if seller else None,
        }
    
    # Create new chat
    chat = models.FleaMarketChat(
        item_id=chat_data.item_id,
        buyer_id=current_user.id,
        seller_id=item.seller_id,
        status="active",
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    
    # Add initial message if provided
    if chat_data.initial_message:
        message = models.FleaMarketMessage(
            chat_id=chat.id,
            sender_id=current_user.id,
            body=chat_data.initial_message,
        )
        db.add(message)
        db.commit()
    
    seller = db.query(models.User).filter(models.User.id == item.seller_id).first()
    
    return {
        "id": chat.id,
        "item_id": chat.item_id,
        "buyer_id": chat.buyer_id,
        "seller_id": chat.seller_id,
        "status": chat.status,
        "created_at": chat.created_at,
        "updated_at": chat.updated_at,
        "item_title": item.title,
        "buyer_display_name": current_user.display_name,
        "seller_display_name": seller.display_name if seller else None,
    }


@router.get("/chats", response_model=List[schemas.FleaMarketChat])
def list_chats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all chats for the current user"""
    chats = db.query(models.FleaMarketChat).filter(
        (models.FleaMarketChat.buyer_id == current_user.id) |
        (models.FleaMarketChat.seller_id == current_user.id)
    ).order_by(desc(models.FleaMarketChat.updated_at)).all()
    
    result = []
    for chat in chats:
        item = db.query(models.FleaMarketItem).filter(models.FleaMarketItem.id == chat.item_id).first()
        buyer = db.query(models.User).filter(models.User.id == chat.buyer_id).first()
        seller = db.query(models.User).filter(models.User.id == chat.seller_id).first()
        
        result.append({
            "id": chat.id,
            "item_id": chat.item_id,
            "buyer_id": chat.buyer_id,
            "seller_id": chat.seller_id,
            "status": chat.status,
            "created_at": chat.created_at,
            "updated_at": chat.updated_at,
            "item_title": item.title if item else None,
            "buyer_display_name": buyer.display_name if buyer else None,
            "seller_display_name": seller.display_name if seller else None,
        })
    
    return result


@router.get("/chats/{chat_id}/messages", response_model=List[schemas.FleaMarketMessage])
def get_chat_messages(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get messages for a chat"""
    chat = db.query(models.FleaMarketChat).filter(models.FleaMarketChat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Check if user is part of the chat
    if chat.buyer_id != current_user.id and chat.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this chat")
    
    messages = db.query(models.FleaMarketMessage).filter(
        models.FleaMarketMessage.chat_id == chat_id
    ).order_by(models.FleaMarketMessage.created_at).all()
    
    result = []
    for msg in messages:
        sender = db.query(models.User).filter(models.User.id == msg.sender_id).first()
        result.append({
            "id": msg.id,
            "chat_id": msg.chat_id,
            "sender_id": msg.sender_id,
            "body": msg.body,
            "created_at": msg.created_at,
            "sender_display_name": sender.display_name if sender else None,
        })
    
    return result


@router.post("/chats/{chat_id}/messages", response_model=schemas.FleaMarketMessage)
def send_message(
    chat_id: int,
    message_data: schemas.FleaMarketMessageBase,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Send a message in a chat"""
    chat = db.query(models.FleaMarketChat).filter(models.FleaMarketChat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Check if user is part of the chat
    if chat.buyer_id != current_user.id and chat.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this chat")
    
    # Check if chat is active
    if chat.status != "active":
        raise HTTPException(status_code=400, detail="Chat is closed")
    
    # Create message
    message = models.FleaMarketMessage(
        chat_id=chat_id,
        sender_id=current_user.id,
        body=message_data.body,
    )
    db.add(message)
    
    # Update chat timestamp
    chat.updated_at = message.created_at
    
    db.commit()
    db.refresh(message)
    
    return {
        "id": message.id,
        "chat_id": message.chat_id,
        "sender_id": message.sender_id,
        "body": message.body,
        "created_at": message.created_at,
        "sender_display_name": current_user.display_name,
    }


@router.get("/my-items", response_model=List[schemas.FleaMarketItem])
def get_my_items(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get all items posted by the current user"""
    items = db.query(models.FleaMarketItem).filter(
        models.FleaMarketItem.seller_id == current_user.id
    ).order_by(desc(models.FleaMarketItem.created_at)).all()
    
    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.id).first()
    
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "user_id": item.seller_id,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "category": item.category,
            "region": item.region,
            "transaction_method": item.transaction_method,
            "status": item.status,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "images": [{"id": img.id, "image_url": img.image_url, "display_order": img.display_order} for img in item.images],
            "user_display_name": current_user.display_name,
            "user_avatar_url": profile.avatar_url if profile else None,
        })
    
    return result
