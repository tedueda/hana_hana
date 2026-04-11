from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, get_current_active_user

router = APIRouter(prefix="/api/art-sales", tags=["art-sales"])


def require_premium(current_user: models.User = Depends(get_current_active_user)) -> models.User:
    if current_user.membership_type not in ("premium", "admin", "founder_free"):
        raise HTTPException(status_code=403, detail={"error": "premium_required"})
    return current_user

ART_SALE_CATEGORIES = [
    "painting",      # 絵画
    "sculpture",     # 彫刻
    "digital",       # デジタルアート
    "photography",   # 写真
    "calligraphy",   # 書道
    "crafts",        # 工芸
    "illustration",  # イラスト
    "other",         # その他
]


@router.get("/categories")
def get_categories():
    """Get all available art categories"""
    return [{"id": cat, "name": cat} for cat in ART_SALE_CATEGORIES]


@router.get("/items", response_model=List[schemas.ArtSaleItem])
def list_items(
    category: Optional[str] = None,
    status: Optional[str] = "active",
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_premium),
):
    """List all art sale items with optional filters"""
    query = db.query(models.ArtSaleItem)
    
    if category:
        query = query.filter(models.ArtSaleItem.category == category)
    if status:
        query = query.filter(models.ArtSaleItem.status == status)
    
    items = query.order_by(desc(models.ArtSaleItem.created_at)).offset(skip).limit(limit).all()
    
    result = []
    for item in items:
        profile = db.query(models.Profile).filter(models.Profile.user_id == item.seller_id).first()
        user = db.query(models.User).filter(models.User.id == item.seller_id).first()
        result.append({
            "id": item.id,
            "user_id": item.seller_id,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "category": item.category,
            "technique": item.technique,
            "size": item.size,
            "year_created": item.year_created,
            "is_original": item.is_original,
            "transaction_method": item.transaction_method,
            "status": item.status,
            "view_count": item.view_count,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "images": [{"id": img.id, "image_url": img.image_url, "display_order": img.display_order} for img in item.images],
            "user_display_name": user.display_name if user else None,
            "user_avatar_url": profile.avatar_url if profile else None,
        })
    
    return result


@router.get("/items/{item_id}", response_model=schemas.ArtSaleItem)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_premium),
):
    """Get a specific art sale item"""
    item = db.query(models.ArtSaleItem).filter(models.ArtSaleItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Increment view count
    item.view_count += 1
    db.commit()
    
    profile = db.query(models.Profile).filter(models.Profile.user_id == item.seller_id).first()
    user = db.query(models.User).filter(models.User.id == item.seller_id).first()
    
    return {
        "id": item.id,
        "user_id": item.seller_id,
        "title": item.title,
        "description": item.description,
        "price": item.price,
        "category": item.category,
        "technique": item.technique,
        "size": item.size,
        "year_created": item.year_created,
        "is_original": item.is_original,
        "transaction_method": item.transaction_method,
        "status": item.status,
        "view_count": item.view_count,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "images": [{"id": img.id, "image_url": img.image_url, "display_order": img.display_order} for img in item.images],
        "user_display_name": user.display_name if user else None,
        "user_avatar_url": profile.avatar_url if profile else None,
    }


@router.post("/items", response_model=schemas.ArtSaleItem)
def create_item(
    item_data: schemas.ArtSaleItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_premium),
):
    """Create a new art sale item"""
    item = models.ArtSaleItem(
        seller_id=current_user.id,
        title=item_data.title,
        description=item_data.description,
        price=item_data.price,
        category=item_data.category,
        technique=item_data.technique,
        size=item_data.size,
        year_created=item_data.year_created,
        is_original=item_data.is_original,
        transaction_method=item_data.transaction_method,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Add images
    if item_data.image_urls:
        for i, url in enumerate(item_data.image_urls):
            image = models.ArtSaleItemImage(
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
        "technique": item.technique,
        "size": item.size,
        "year_created": item.year_created,
        "is_original": item.is_original,
        "transaction_method": item.transaction_method,
        "status": item.status,
        "view_count": item.view_count,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "images": [{"id": img.id, "image_url": img.image_url, "display_order": img.display_order} for img in item.images],
        "user_display_name": current_user.display_name,
        "user_avatar_url": profile.avatar_url if profile else None,
    }


@router.put("/items/{item_id}", response_model=schemas.ArtSaleItem)
def update_item(
    item_id: int,
    item_data: schemas.ArtSaleItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_premium),
):
    """Update an art sale item"""
    item = db.query(models.ArtSaleItem).filter(models.ArtSaleItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this item")
    
    # Update fields
    update_data = item_data.dict(exclude_unset=True)
    image_urls = update_data.pop("image_urls", None)
    
    for field, value in update_data.items():
        setattr(item, field, value)
    
    # Update images if provided
    if image_urls is not None:
        # Delete existing images
        db.query(models.ArtSaleItemImage).filter(models.ArtSaleItemImage.item_id == item.id).delete()
        # Add new images
        for i, url in enumerate(image_urls):
            image = models.ArtSaleItemImage(
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
        "technique": item.technique,
        "size": item.size,
        "year_created": item.year_created,
        "is_original": item.is_original,
        "transaction_method": item.transaction_method,
        "status": item.status,
        "view_count": item.view_count,
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
    current_user: models.User = Depends(require_premium),
):
    """Delete an art sale item"""
    item = db.query(models.ArtSaleItem).filter(models.ArtSaleItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this item")
    
    # Delete images first
    db.query(models.ArtSaleItemImage).filter(models.ArtSaleItemImage.item_id == item.id).delete()
    # Delete item
    db.delete(item)
    db.commit()
    
    return {"message": "Item deleted successfully"}


@router.get("/my-items", response_model=List[schemas.ArtSaleItem])
def get_my_items(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get all items posted by the current user"""
    items = db.query(models.ArtSaleItem).filter(
        models.ArtSaleItem.seller_id == current_user.id
    ).order_by(desc(models.ArtSaleItem.created_at)).all()
    
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
            "technique": item.technique,
            "size": item.size,
            "year_created": item.year_created,
            "is_original": item.is_original,
            "transaction_method": item.transaction_method,
            "status": item.status,
            "view_count": item.view_count,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "images": [{"id": img.id, "image_url": img.image_url, "display_order": img.display_order} for img in item.images],
            "user_display_name": current_user.display_name,
            "user_avatar_url": profile.avatar_url if profile else None,
        })
    
    return result
