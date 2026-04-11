"""
講座（Courses）API Router

公開エンドポイント:
- GET /api/courses - 講座一覧（public）
- GET /api/courses/:id - 講座詳細（public）
- GET /api/courses/categories - カテゴリ一覧

講師向けエンドポイント（有料会員のみ）:
- POST /api/courses - 講座作成
- PUT /api/courses/:id - 講座編集（owner only）
- DELETE /api/courses/:id - 講座削除（owner only）
"""

import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.auth import get_current_active_user, get_optional_user
from app import models, schemas

router = APIRouter(prefix="/api/courses", tags=["courses"])

# カテゴリ定義（日本語ラベル付き）
COURSE_CATEGORIES = [
    {"id": "business", "name": "ビジネス"},
    {"id": "creative", "name": "クリエイティブ"},
    {"id": "language", "name": "語学"},
    {"id": "health", "name": "健康"},
    {"id": "relationship", "name": "恋愛・関係"},
    {"id": "life", "name": "ライフ"},
    {"id": "other", "name": "その他"},
]

MAX_IMAGES = 5
MAX_VIDEOS = 6


def extract_youtube_video_id(url: str) -> Optional[str]:
    """
    YouTube URLからvideo IDを抽出
    対応形式:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    """
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def require_paid_user(current_user: models.User = Depends(get_current_active_user)) -> models.User:
    """有料会員（premium, admin, founder_free）のみ許可"""
    if current_user.membership_type not in ("premium", "admin", "founder_free"):
        raise HTTPException(status_code=403, detail={"error": "premium_required"})
    return current_user


def get_course_response(course: models.Course, db: Session) -> dict:
    """講座レスポンスを構築"""
    owner = db.query(models.User).filter(models.User.id == course.owner_user_id).first()
    profile = db.query(models.Profile).filter(models.Profile.user_id == course.owner_user_id).first()
    
    return {
        "id": course.id,
        "owner_user_id": course.owner_user_id,
        "title": course.title,
        "description": course.description,
        "category": course.category,
        "price_label": course.price_label,
        "external_url": course.external_url,
        "instructor_profile": course.instructor_profile,
        "published": course.published,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
        "images": [
            {"id": img.id, "image_url": img.image_url, "sort_order": img.sort_order}
            for img in course.images
        ],
        "videos": [
            {
                "id": vid.id,
                "youtube_url": vid.youtube_url,
                "youtube_video_id": vid.youtube_video_id,
                "sort_order": vid.sort_order,
            }
            for vid in course.videos
        ],
        "owner_display_name": owner.display_name if owner else None,
        "owner_avatar_url": profile.avatar_url if profile else None,
    }


@router.get("/categories")
def get_categories():
    """カテゴリ一覧を取得"""
    return COURSE_CATEGORIES


@router.get("", response_model=List[schemas.Course])
def list_courses(
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    講座一覧を取得（public）
    - カテゴリでフィルタ可能
    - 新着順でソート
    """
    query = db.query(models.Course).filter(models.Course.published == True)
    
    if category:
        query = query.filter(models.Course.category == category)
    
    courses = query.order_by(desc(models.Course.created_at)).offset(skip).limit(limit).all()
    
    return [get_course_response(course, db) for course in courses]


@router.get("/{course_id}", response_model=schemas.Course)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
):
    """講座詳細を取得（public）"""
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return get_course_response(course, db)


@router.post("", response_model=schemas.Course)
def create_course(
    course_data: schemas.CourseCreate,
    current_user: models.User = Depends(require_paid_user),
    db: Session = Depends(get_db),
):
    """
    講座を作成（有料会員のみ）
    - 画像は最大5件
    - YouTube URLは最大6件
    """
    # バリデーション: タイトル長
    if len(course_data.title) > 80:
        raise HTTPException(status_code=400, detail="Title must be 80 characters or less")
    
    # バリデーション: 説明文長
    if len(course_data.description) > 3000:
        raise HTTPException(status_code=400, detail="Description must be 3000 characters or less")
    
    # バリデーション: 画像数
    image_urls = course_data.image_urls or []
    if len(image_urls) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMAGES} images allowed")
    
    # バリデーション: 動画数
    youtube_urls = course_data.youtube_urls or []
    if len(youtube_urls) > MAX_VIDEOS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_VIDEOS} videos allowed")
    
    # バリデーション: 外部URL形式
    if not course_data.external_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="External URL must start with http:// or https://")
    
    # バリデーション: 講師プロフィール長
    if course_data.instructor_profile and len(course_data.instructor_profile) > 1000:
        raise HTTPException(status_code=400, detail="Instructor profile must be 1000 characters or less")
    
    # 講座を作成
    course = models.Course(
        owner_user_id=current_user.id,
        title=course_data.title,
        description=course_data.description,
        category=course_data.category.value,
        price_label=course_data.price_label,
        external_url=course_data.external_url,
        instructor_profile=course_data.instructor_profile,
        published=True,
    )
    db.add(course)
    db.flush()  # IDを取得するためにflush
    
    # 画像を追加
    for i, url in enumerate(image_urls):
        img = models.CourseImage(
            course_id=course.id,
            image_url=url,
            sort_order=i,
        )
        db.add(img)
    
    # 動画を追加
    for i, url in enumerate(youtube_urls):
        video_id = extract_youtube_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail=f"Invalid YouTube URL: {url}")
        vid = models.CourseVideo(
            course_id=course.id,
            youtube_url=url,
            youtube_video_id=video_id,
            sort_order=i,
        )
        db.add(vid)
    
    db.commit()
    db.refresh(course)
    
    return get_course_response(course, db)


@router.put("/{course_id}", response_model=schemas.Course)
def update_course(
    course_id: int,
    course_data: schemas.CourseUpdate,
    current_user: models.User = Depends(require_paid_user),
    db: Session = Depends(get_db),
):
    """
    講座を更新（owner only）
    - 画像は最大5件
    - YouTube URLは最大6件
    """
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # オーナーチェック
    if course.owner_user_id != current_user.id and current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to edit this course")
    
    # フィールドを更新
    if course_data.title is not None:
        if len(course_data.title) > 80:
            raise HTTPException(status_code=400, detail="Title must be 80 characters or less")
        course.title = course_data.title
    
    if course_data.description is not None:
        if len(course_data.description) > 3000:
            raise HTTPException(status_code=400, detail="Description must be 3000 characters or less")
        course.description = course_data.description
    
    if course_data.category is not None:
        course.category = course_data.category.value
    
    if course_data.price_label is not None:
        course.price_label = course_data.price_label
    
    if course_data.external_url is not None:
        if not course_data.external_url.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="External URL must start with http:// or https://")
        course.external_url = course_data.external_url
    
    if course_data.instructor_profile is not None:
        if len(course_data.instructor_profile) > 1000:
            raise HTTPException(status_code=400, detail="Instructor profile must be 1000 characters or less")
        course.instructor_profile = course_data.instructor_profile
    
    # 画像を更新（全置換）
    if course_data.image_urls is not None:
        if len(course_data.image_urls) > MAX_IMAGES:
            raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMAGES} images allowed")
        
        # 既存の画像を削除
        db.query(models.CourseImage).filter(models.CourseImage.course_id == course_id).delete()
        
        # 新しい画像を追加
        for i, url in enumerate(course_data.image_urls):
            img = models.CourseImage(
                course_id=course.id,
                image_url=url,
                sort_order=i,
            )
            db.add(img)
    
    # 動画を更新（全置換）
    if course_data.youtube_urls is not None:
        if len(course_data.youtube_urls) > MAX_VIDEOS:
            raise HTTPException(status_code=400, detail=f"Maximum {MAX_VIDEOS} videos allowed")
        
        # 既存の動画を削除
        db.query(models.CourseVideo).filter(models.CourseVideo.course_id == course_id).delete()
        
        # 新しい動画を追加
        for i, url in enumerate(course_data.youtube_urls):
            video_id = extract_youtube_video_id(url)
            if not video_id:
                raise HTTPException(status_code=400, detail=f"Invalid YouTube URL: {url}")
            vid = models.CourseVideo(
                course_id=course.id,
                youtube_url=url,
                youtube_video_id=video_id,
                sort_order=i,
            )
            db.add(vid)
    
    db.commit()
    db.refresh(course)
    
    return get_course_response(course, db)


@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    current_user: models.User = Depends(require_paid_user),
    db: Session = Depends(get_db),
):
    """講座を削除（owner only）"""
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # オーナーチェック
    if course.owner_user_id != current_user.id and current_user.membership_type != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this course")
    
    db.delete(course)
    db.commit()
    
    return {"message": "Course deleted successfully"}


@router.post("/{course_id}/contact")
def contact_course_owner(
    course_id: int,
    current_user: models.User = Depends(require_paid_user),
    db: Session = Depends(get_db),
):
    """
    講座の投稿者に問い合わせ（チャットリクエスト送信）
    """
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # 自分の講座には問い合わせできない
    if course.owner_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot contact yourself")
    
    # 既存のチャットリクエストを確認
    existing_request = db.query(models.ChatRequest).filter(
        ((models.ChatRequest.from_user_id == current_user.id) & (models.ChatRequest.to_user_id == course.owner_user_id)) |
        ((models.ChatRequest.from_user_id == course.owner_user_id) & (models.ChatRequest.to_user_id == current_user.id))
    ).first()
    
    if existing_request:
        # 既存のチャットがあるか確認
        if existing_request.status == "accepted":
            # 承認済みの場合、チャットを探す
            chat = db.query(models.Chat).join(models.Match).filter(
                ((models.Match.user_a_id == current_user.id) & (models.Match.user_b_id == course.owner_user_id)) |
                ((models.Match.user_a_id == course.owner_user_id) & (models.Match.user_b_id == current_user.id))
            ).first()
            if chat:
                return {"chat_id": chat.id, "existing": True, "status": "accepted"}
        return {"request_id": existing_request.id, "existing": True, "status": existing_request.status}
    
    # 新しいチャットリクエストを作成
    chat_request = models.ChatRequest(
        from_user_id=current_user.id,
        to_user_id=course.owner_user_id,
        initial_message=f"【講座についてのお問い合わせ】\n「{course.title}」について質問があります。",
        status="pending",
    )
    db.add(chat_request)
    db.commit()
    db.refresh(chat_request)
    
    return {"request_id": chat_request.id, "existing": False, "status": "pending"}


@router.get("/my/courses", response_model=List[schemas.Course])
def get_my_courses(
    current_user: models.User = Depends(require_paid_user),
    db: Session = Depends(get_db),
):
    """自分の講座一覧を取得（有料会員のみ）"""
    courses = (
        db.query(models.Course)
        .filter(models.Course.owner_user_id == current_user.id)
        .order_by(desc(models.Course.created_at))
        .all()
    )
    
    return [get_course_response(course, db) for course in courses]
