import uuid
import json
import os
import re
import io
import logging
from datetime import datetime, timezone
from typing import Optional, List
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import or_, func as sa_func
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.auth import get_current_admin_user, verify_password, create_access_token, get_password_hash
from app.models import User, BlogPost, BlogPostTranslation, AuditLog, Founder, Ambassador, Referral, MatchingProfile, SalonRoom
from app.services.google_indexing import get_indexing_service

logger = logging.getLogger(__name__)

UPLOAD_MAX_MB = int(os.getenv("UPLOAD_MAX_MB", "5"))
UPLOAD_ALLOWED_EXT = set(os.getenv("UPLOAD_ALLOWED_EXT", "jpg,jpeg,png,webp").split(","))
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}

S3_BUCKET = os.getenv("AWS_S3_BUCKET", "rainbow-community-media-prod")
S3_REGION = os.getenv("AWS_REGION", "ap-northeast-1")
USE_S3 = os.getenv("USE_S3", "false").lower() == "true"

if USE_S3:
    s3_client = boto3.client(
        "s3",
        region_name=S3_REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )
else:
    s3_client = None

LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.7"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "4096"))

ADMIN_SEED_EMAIL = os.getenv("ADMIN_SEED_EMAIL", "ted@carat-community.com")
ADMIN_SEED_PASSWORD = os.getenv("ADMIN_SEED_PASSWORD", "")

router = APIRouter(tags=["admin"])

limiter = Limiter(key_func=get_remote_address)


def _write_audit(db: Session, admin_id: int, action: str, request: Request,
                 target_type: str = None, target_id: str = None, metadata: dict = None):
    log = AuditLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_=metadata or {},
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
    )
    db.add(log)
    db.commit()


# ──────────────── Auth ────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class MeResponse(BaseModel):
    id: int
    email: str
    display_name: str
    role: str


@router.post("/api/auth/admin/login", response_model=LoginResponse)
def admin_login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.deleted_at.is_(None)).first()
    if not user or not verify_password(body.password, user.password_hash):
        _try_audit_fail(db, body.email, request)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if getattr(user, "role", "user") != "admin" and user.membership_type != "admin":
        _try_audit_fail(db, body.email, request)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    from datetime import timedelta
    token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(hours=24))
    _write_audit(db, user.id, "ADMIN_LOGIN_SUCCESS", request)
    return LoginResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "display_name": user.display_name, "role": getattr(user, "role", "admin")},
    )


def _try_audit_fail(db: Session, email: str, request: Request):
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            _write_audit(db, user.id, "ADMIN_LOGIN_FAIL", request)
    except Exception:
        pass


@router.get("/api/auth/admin/me", response_model=MeResponse)
def admin_me(current_user: User = Depends(get_current_admin_user)):
    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        role=getattr(current_user, "role", "admin"),
    )


# ──────────────── Users ────────────────

def _is_profile_complete(mp, user_display_name: str = "") -> bool:
    """Check if a matching profile has all required fields filled.
    
    Required: display_name (from User), community_category, prefecture, age_band, meeting_style.
    Note: display_name is on User model, not MatchingProfile.
    """
    if mp is None:
        return False
    cat = getattr(mp, 'community_category', None) or getattr(mp, 'identity', None)
    name = user_display_name or getattr(mp, 'nickname', None)
    return bool(
        name
        and cat
        and getattr(mp, 'prefecture', None)
        and getattr(mp, 'age_band', None)
        and (getattr(mp, 'meeting_style', None) or getattr(mp, 'meet_pref', None))
    )

class UserListItem(BaseModel):
    id: int
    email: str
    display_name: str
    created_at: Optional[datetime] = None
    payment_status: Optional[str] = None
    subscription_status: Optional[str] = None
    is_active: bool = True
    community_category: Optional[str] = None
    position: Optional[str] = None
    profile_complete: bool = False
    account_status: Optional[str] = None
    membership_type: Optional[str] = None
    card_required: Optional[bool] = None
    card_registered: Optional[bool] = None
    kyc_status: Optional[str] = None
    referred_by_founder_code: Optional[str] = None

class UserListResponse(BaseModel):
    items: List[UserListItem]
    total: int
    page: int
    page_size: int


@router.get("/api/admin/users", response_model=UserListResponse)
def list_users(
    query: str = "",
    status_filter: str = Query("", alias="status"),
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(User).filter(User.deleted_at.is_(None))
    if query:
        pattern = f"%{query}%"
        q = q.filter(or_(User.display_name.ilike(pattern), User.email.ilike(pattern)))
    if status_filter:
        q = q.filter(User.subscription_status == status_filter)
    total = q.count()
    items = q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    # Batch-fetch matching profiles for these users
    user_ids = [u.id for u in items]
    profiles = {}
    if user_ids:
        for mp in db.query(MatchingProfile).filter(MatchingProfile.user_id.in_(user_ids)).all():
            profiles[mp.user_id] = mp
    return UserListResponse(
        items=[
            UserListItem(
                id=u.id,
                email=u.email,
                display_name=u.display_name,
                created_at=u.created_at,
                payment_status=getattr(u, "payment_status", None),
                subscription_status=u.subscription_status,
                is_active=u.is_active,
                community_category=getattr(profiles.get(u.id), 'community_category', None) or getattr(profiles.get(u.id), 'identity', None),
                position=getattr(profiles.get(u.id), 'position', None),
                profile_complete=_is_profile_complete(profiles.get(u.id), u.display_name or ""),
                account_status=getattr(u, 'account_status', None),
                membership_type=u.membership_type,
                card_required=getattr(u, 'card_required', None),
                card_registered=getattr(u, 'card_registered', None),
                kyc_status=u.kyc_status,
                referred_by_founder_code=getattr(u, 'referred_by_founder_code', None),
            )
            for u in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, request: Request,
                current_user: User = Depends(get_current_admin_user),
                db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    deleted_referrals = db.query(Referral).filter(Referral.user_id == user_id).delete(synchronize_session=False)
    db.commit()
    _write_audit(db, current_user.id, "USER_DELETE", request, target_type="user", target_id=str(user_id))
    return {"ok": True, "deleted_referrals": deleted_referrals}


@router.post("/api/admin/users/{user_id}/restore")
def restore_user(user_id: int, request: Request,
                 current_user: User = Depends(get_current_admin_user),
                 db: Session = Depends(get_db)):
    """Restore a soft-deleted user by clearing deleted_at and reactivating."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.isnot(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Deleted user not found")
    user.deleted_at = None
    user.is_active = True
    db.commit()
    db.refresh(user)
    _write_audit(db, current_user.id, "USER_RESTORE", request, target_type="user", target_id=str(user_id))
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "membership_type": user.membership_type,
            "account_status": getattr(user, 'account_status', None),
            "kyc_status": user.kyc_status,
            "is_active": user.is_active,
        }
    }


class UpdateUserRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = None
    is_active: Optional[bool] = None
    membership_type: Optional[str] = None
    subscription_status: Optional[str] = None
    email_verified: Optional[bool] = None
    kyc_status: Optional[str] = None
    subscription_exempt: Optional[bool] = None
    account_status: Optional[str] = None


@router.put("/api/admin/users/update")
def update_user_by_email(
    body: UpdateUserRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == body.email, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    updates = {}
    if body.password is not None:
        user.password_hash = get_password_hash(body.password)
        updates["password"] = "updated"
    if body.is_active is not None:
        user.is_active = body.is_active
        updates["is_active"] = body.is_active
    if body.membership_type is not None:
        user.membership_type = body.membership_type
        updates["membership_type"] = body.membership_type
    if body.subscription_status is not None:
        user.subscription_status = body.subscription_status
        updates["subscription_status"] = body.subscription_status
    if body.email_verified is not None:
        user.email_verified = body.email_verified
        updates["email_verified"] = body.email_verified
    if body.kyc_status is not None:
        user.kyc_status = body.kyc_status
        updates["kyc_status"] = body.kyc_status
    if body.subscription_exempt is not None:
        user.subscription_exempt = body.subscription_exempt
        updates["subscription_exempt"] = body.subscription_exempt
    if body.account_status is not None:
        user.account_status = body.account_status
        updates["account_status"] = body.account_status
    
    db.commit()
    db.refresh(user)
    _write_audit(db, current_user.id, "USER_UPDATE", request, target_type="user", target_id=str(user.id), metadata=updates)
    
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "is_active": user.is_active,
            "membership_type": user.membership_type,
            "subscription_status": user.subscription_status
        }
    }


@router.get("/api/admin/users/by-email/{email}")
def get_user_by_email(
    email: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "is_active": user.is_active,
        "membership_type": user.membership_type,
        "subscription_status": user.subscription_status,
        "stripe_customer_id": user.stripe_customer_id,
        "stripe_subscription_id": user.stripe_subscription_id,
        "created_at": user.created_at
    }


# ──────────────── DEV ONLY - Remove after use ────────────────

class UpdateUserRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = None
    is_active: Optional[bool] = None
    membership_type: Optional[str] = None
    subscription_status: Optional[str] = None
    email_verified: Optional[bool] = None

@router.put("/api/dev/users/fix")
def dev_fix_user(
    body: UpdateUserRequest,
    db: Session = Depends(get_db)
):
    """DEV ONLY: Fix user without authentication. REMOVE THIS ENDPOINT AFTER USE."""
    user = db.query(User).filter(User.email == body.email, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    updates = {}
    if body.password is not None:
        user.password_hash = get_password_hash(body.password)
        updates["password"] = "updated"
    if body.is_active is not None:
        user.is_active = body.is_active
        updates["is_active"] = body.is_active
    if body.membership_type is not None:
        user.membership_type = body.membership_type
        updates["membership_type"] = body.membership_type
    if body.subscription_status is not None:
        user.subscription_status = body.subscription_status
        updates["subscription_status"] = body.subscription_status
    if body.email_verified is not None:
        user.email_verified = body.email_verified
        updates["email_verified"] = body.email_verified
    
    db.commit()
    db.refresh(user)
    
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "is_active": user.is_active,
            "membership_type": user.membership_type,
            "subscription_status": user.subscription_status
        },
        "updates": updates
    }

@router.get("/api/dev/users/check/{email}")
def dev_check_user(
    email: str,
    db: Session = Depends(get_db)
):
    """DEV ONLY: Check user without authentication. REMOVE THIS ENDPOINT AFTER USE."""
    user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "is_active": user.is_active,
        "membership_type": user.membership_type,
        "subscription_status": user.subscription_status,
        "email_verified": user.email_verified,
        "stripe_customer_id": user.stripe_customer_id,
        "stripe_subscription_id": user.stripe_subscription_id,
        "created_at": user.created_at
    }

# ──────────────── Upload ────────────────

@router.post("/api/admin/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in UPLOAD_ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Invalid extension: {ext}")
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"Invalid content type: {file.content_type}")
    data = await file.read()
    if len(data) > UPLOAD_MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")
    def _detect_kind(d: bytes) -> str:
        if len(d) >= 8 and d[:8] == b'\x89PNG\r\n\x1a\n':
            return "png"
        if len(d) >= 3 and d[:3] == b'\xff\xd8\xff':
            return "jpeg"
        if len(d) >= 12 and d[:4] == b'RIFF' and d[8:12] == b'WEBP':
            return "webp"
        return "unknown"
    kind = _detect_kind(data)
    if kind not in ("jpeg", "png", "webp"):
        raise HTTPException(status_code=400, detail="Invalid image content")

    fname = f"{uuid.uuid4().hex}.{ext}"

    if USE_S3 and s3_client:
        try:
            s3_key = f"media/blog/{fname}"
            s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=data,
                ContentType=file.content_type or "application/octet-stream",
            )
            url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        except ClientError as e:
            raise HTTPException(status_code=500, detail=f"S3 upload failed: {str(e)}")
    else:
        media_base = os.getenv("MEDIA_DIR")
        if not media_base:
            media_base = "/data/media" if os.path.exists("/data") else "media"
        media_dir = Path(media_base) / "blog"
        media_dir.mkdir(parents=True, exist_ok=True)
        fpath = media_dir / fname
        fpath.write_bytes(data)
        url = f"/media/blog/{fname}"

    _write_audit(db, current_user.id, "IMAGE_UPLOAD", request, target_type="blog", metadata={"filename": fname})
    return {"url": url, "filename": fname}


# ──────────────── Blog Generate ────────────────

class GenerateRequest(BaseModel):
    title_candidates: List[str]
    image_url: str = ""

class GenerateResponse(BaseModel):
    keywords: List[str]
    final_title: str
    body: str
    excerpt: str
    slug: str


def _slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[\s_]+", "-", s).strip("-")[:200]


def _parse_llm_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise


@router.post("/api/admin/blog/generate", response_model=GenerateResponse)
@limiter.limit(os.getenv("RATE_LIMIT_BLOG_GEN_PER_MIN", "1") + "/minute")
def generate_blog(
    body: GenerateRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    import openai

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    client = openai.OpenAI(api_key=api_key)

    titles_text = "\n".join(f"- {t}" for t in body.title_candidates)
    system_prompt = (
        "You are an SEO blog writer for Carat, an inclusive LGBTQ+ community platform. "
        "Carat's goal is to attract new members through valuable, honest content. "
        "Do NOT use exaggerated claims or misleading language. "
        "Write in Japanese. "
        "Return ONLY valid JSON with these keys: "
        "keywords (array of 3-8 SEO keywords), "
        "final_title (the best title from candidates or improved), "
        "body (blog body text, exactly 1800-2200 Japanese characters, naturally integrating keywords), "
        "excerpt (120 character summary), "
        "slug (URL-friendly ASCII slug derived from the title)."
    )
    user_prompt = (
        f"Title candidates:\n{titles_text}\n\n"
        f"Image URL: {body.image_url}\n\n"
        "Generate the blog post as JSON."
    )

    result = None
    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model=LLM_MODEL,
                temperature=LLM_TEMPERATURE,
                max_tokens=LLM_MAX_TOKENS,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content
            result = _parse_llm_json(raw)
            break
        except Exception as e:
            logger.warning("LLM attempt %d failed: %s", attempt + 1, e)
            if attempt == 2:
                raise HTTPException(status_code=500, detail=f"Blog generation failed after retries: {e}")

    keywords = result.get("keywords", [])[:8]
    final_title = result.get("final_title", body.title_candidates[0] if body.title_candidates else "Untitled")
    blog_body = result.get("body", "")
    excerpt = result.get("excerpt", "")[:200]
    slug = _slugify(result.get("slug", final_title))

    if not slug:
        slug = uuid.uuid4().hex[:12]

    existing = db.query(BlogPost).filter(BlogPost.slug == slug).first()
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    _write_audit(db, current_user.id, "BLOG_GENERATE", request, target_type="blog",
                 metadata={"title": final_title, "char_count": len(blog_body)})

    return GenerateResponse(
        keywords=keywords,
        final_title=final_title,
        body=blog_body,
        excerpt=excerpt,
        slug=slug,
    )


# ──────────────── Blog CRUD ────────────────
# Version: 2026-04-25 - Added blog edit endpoints

class BlogSaveRequest(BaseModel):
    title: str
    slug: str
    body: str
    excerpt: str = ""
    image_url: str = ""
    seo_keywords: List[str] = []

class BlogPublishResponse(BaseModel):
    id: str
    slug: str
    status: str
    published_at: Optional[datetime] = None


@router.post("/api/admin/blog")
def save_draft(
    body: BlogSaveRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    existing = db.query(BlogPost).filter(BlogPost.slug == body.slug).first()
    if existing:
        body.slug = f"{body.slug}-{uuid.uuid4().hex[:6]}"

    post = BlogPost(
        title=body.title,
        slug=body.slug,
        body=body.body,
        excerpt=body.excerpt,
        image_url=body.image_url,
        seo_keywords=body.seo_keywords,
        status="draft",
        created_by_admin_id=current_user.id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    _write_audit(db, current_user.id, "BLOG_DRAFT_SAVE", request, target_type="blog", target_id=str(post.id))
    return {"id": str(post.id), "slug": post.slug, "status": post.status}


@router.post("/api/admin/blog/{blog_id}/publish", response_model=BlogPublishResponse)
def publish_blog(
    blog_id: str,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        uid = uuid.UUID(blog_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid blog ID")
    post = db.query(BlogPost).filter(BlogPost.id == uid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog not found")
    now = datetime.now(timezone.utc)
    post.status = "published"
    post.published_at = now
    db.commit()
    db.refresh(post)
    _write_audit(db, current_user.id, "BLOG_PUBLISH", request, target_type="blog", target_id=str(post.id))
    
    # Notify Google Indexing API about new blog post
    try:
        blog_url = f"https://carat-community.com/blog/{post.slug}"
        indexing_service = get_indexing_service()
        indexing_service.notify_url_updated(blog_url)
        logger.info(f"Notified Google Indexing API about published blog: {blog_url}")
    except Exception as e:
        # Don't fail the publish operation if indexing notification fails
        logger.error(f"Failed to notify Google Indexing API: {e}")
    
    return BlogPublishResponse(id=str(post.id), slug=post.slug, status=post.status, published_at=post.published_at)


@router.delete("/api/admin/blog/{blog_id}")
def delete_blog(
    blog_id: str,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        uid = uuid.UUID(blog_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid blog ID")
    post = db.query(BlogPost).filter(BlogPost.id == uid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog not found")
    
    # Store slug before deletion for Google notification
    blog_slug = post.slug
    
    _write_audit(db, current_user.id, "BLOG_DELETE", request, target_type="blog", target_id=str(post.id), metadata={"title": post.title})
    db.delete(post)
    db.commit()
    
    # Notify Google Indexing API about deleted blog post
    try:
        blog_url = f"https://carat-community.com/blog/{blog_slug}"
        indexing_service = get_indexing_service()
        indexing_service.notify_url_deleted(blog_url)
        logger.info(f"Notified Google Indexing API about deleted blog: {blog_url}")
    except Exception as e:
        logger.error(f"Failed to notify Google Indexing API about deletion: {e}")
    
    return {"ok": True}


class AdminBlogItem(BaseModel):
    id: str
    title: str
    slug: str
    status: str
    image_url: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


@router.get("/api/admin/blog", response_model=List[AdminBlogItem])
def admin_blog_list(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    posts = db.query(BlogPost).order_by(BlogPost.created_at.desc()).all()
    return [
        AdminBlogItem(
            id=str(p.id), title=p.title, slug=p.slug, status=p.status,
            image_url=p.image_url, published_at=p.published_at, created_at=p.created_at,
        )
        for p in posts
    ]


class BlogDetailResponse(BaseModel):
    id: str
    title: str
    slug: str
    body: str
    excerpt: str
    image_url: Optional[str] = None
    seo_keywords: List[str] = []
    status: str
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


@router.get("/api/admin/blog/{blog_id}", response_model=BlogDetailResponse)
def get_blog_detail(
    blog_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        uid = uuid.UUID(blog_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid blog ID")
    post = db.query(BlogPost).filter(BlogPost.id == uid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog not found")
    return BlogDetailResponse(
        id=str(post.id),
        title=post.title,
        slug=post.slug,
        body=post.body,
        excerpt=post.excerpt or "",
        image_url=post.image_url,
        seo_keywords=post.seo_keywords or [],
        status=post.status,
        published_at=post.published_at,
        created_at=post.created_at,
    )


class BlogUpdateRequest(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    excerpt: Optional[str] = None
    image_url: Optional[str] = None
    seo_keywords: Optional[List[str]] = None


@router.put("/api/admin/blog/{blog_id}")
def update_blog(
    blog_id: str,
    body: BlogUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        uid = uuid.UUID(blog_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid blog ID")
    post = db.query(BlogPost).filter(BlogPost.id == uid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog not found")
    
    updates = {}
    if body.title is not None:
        post.title = body.title
        updates["title"] = body.title
    if body.body is not None:
        post.body = body.body
        updates["body_length"] = len(body.body)
    if body.excerpt is not None:
        post.excerpt = body.excerpt
        updates["excerpt"] = body.excerpt
    if body.image_url is not None:
        post.image_url = body.image_url
        updates["image_url"] = body.image_url
    if body.seo_keywords is not None:
        post.seo_keywords = body.seo_keywords
        updates["seo_keywords"] = body.seo_keywords
    
    db.commit()
    db.refresh(post)
    _write_audit(db, current_user.id, "BLOG_UPDATE", request, target_type="blog", target_id=str(post.id), metadata=updates)
    return {"ok": True, "id": str(post.id), "slug": post.slug}


# ──────────────── Public Blog ────────────────

LANG_NAMES = {
    "en": "English", "ko": "Korean", "es": "Spanish",
    "pt": "Portuguese", "fr": "French", "it": "Italian", "de": "German",
}


@router.get("/sitemap.xml")
def main_sitemap():
    """Generate main XML sitemap"""
    from fastapi.responses import Response
    
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        '',
        '  <!-- ホームページ -->',
        '  <url>',
        '    <loc>https://carat-community.com/</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>',
        '',
        '  <!-- フィード -->',
        '  <url>',
        '    <loc>https://carat-community.com/feed</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>hourly</changefreq>',
        '    <priority>0.9</priority>',
        '  </url>',
        '',
        '  <!-- ブログ一覧 -->',
        '  <url>',
        '    <loc>https://carat-community.com/blog</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.9</priority>',
        '  </url>',
        '',
        '  <!-- マッチング -->',
        '  <url>',
        '    <loc>https://carat-community.com/matching</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
        '',
        '  <!-- サロン -->',
        '  <url>',
        '    <loc>https://carat-community.com/salon</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
        '',
        '  <!-- フリーマーケット -->',
        '  <url>',
        '    <loc>https://carat-community.com/flea-market</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.7</priority>',
        '  </url>',
        '',
        '</urlset>',
    ]
    
    return Response(content='\n'.join(xml_lines), media_type="application/xml")


@router.get("/sitemap-blog.xml")
def blog_sitemap(db: Session = Depends(get_db)):
    """Generate XML sitemap for published blog posts"""
    from fastapi.responses import Response
    posts = db.query(BlogPost).filter(BlogPost.status == "published").order_by(BlogPost.published_at.desc()).all()
    
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    
    for post in posts:
        lastmod = post.published_at.strftime("%Y-%m-%d") if post.published_at else datetime.now().strftime("%Y-%m-%d")
        xml_lines.append(f'  <url>')
        xml_lines.append(f'    <loc>https://carat-community.com/blog/{post.slug}</loc>')
        xml_lines.append(f'    <lastmod>{lastmod}</lastmod>')
        xml_lines.append(f'    <changefreq>weekly</changefreq>')
        xml_lines.append(f'    <priority>0.8</priority>')
        xml_lines.append(f'  </url>')
    
    xml_lines.append('</urlset>')
    
    return Response(content='\n'.join(xml_lines), media_type="application/xml")


def _translate_blog(db: Session, post: BlogPost, lang: str) -> Optional["BlogPostTranslation"]:
    if lang == "ja" or lang not in LANG_NAMES:
        return None
    cached = (
        db.query(BlogPostTranslation)
        .filter(BlogPostTranslation.blog_post_id == post.id, BlogPostTranslation.language == lang)
        .first()
    )
    if cached:
        return cached
    import openai
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return None
    try:
        client = openai.OpenAI(api_key=api_key)
        lang_name = LANG_NAMES[lang]
        kw_text = ", ".join(post.seo_keywords) if post.seo_keywords else ""
        prompt = (
            f"Translate the following Japanese blog post into {lang_name}. "
            "Return ONLY valid JSON with keys: title, body, excerpt, seo_keywords (array of translated keywords). "
            "Preserve paragraph breaks. Do not add any commentary.\n\n"
            f"Title: {post.title}\n\nExcerpt: {post.excerpt or ''}\n\nKeywords: {kw_text}\n\nBody:\n{post.body}"
        )
        resp = client.chat.completions.create(
            model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
            temperature=0.3,
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        result = _parse_llm_json(resp.choices[0].message.content)
        tr = BlogPostTranslation(
            blog_post_id=post.id,
            language=lang,
            title=result.get("title", post.title),
            body=result.get("body", post.body),
            excerpt=result.get("excerpt", post.excerpt),
            seo_keywords=result.get("seo_keywords", post.seo_keywords),
        )
        db.add(tr)
        db.commit()
        db.refresh(tr)
        return tr
    except Exception as e:
        db.rollback()
        logger.warning("Blog translation failed for %s/%s: %s", post.slug, lang, e)
        return None


class PublicBlogItem(BaseModel):
    id: str
    title: str
    slug: str
    excerpt: Optional[str] = None
    image_url: Optional[str] = None
    seo_keywords: Optional[list] = None
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

class PublicBlogDetail(PublicBlogItem):
    body: str


@router.get("/api/blog", response_model=List[PublicBlogItem])
def public_blog_list(lang: str = Query("ja"), db: Session = Depends(get_db)):
    posts = (
        db.query(BlogPost)
        .filter(BlogPost.status == "published")
        .order_by(BlogPost.published_at.desc())
        .all()
    )
    items = []
    for p in posts:
        tr = _translate_blog(db, p, lang) if lang != "ja" else None
        items.append(PublicBlogItem(
            id=str(p.id),
            title=tr.title if tr else p.title,
            slug=p.slug,
            excerpt=tr.excerpt if tr else p.excerpt,
            image_url=p.image_url,
            seo_keywords=tr.seo_keywords if tr else p.seo_keywords,
            published_at=p.published_at,
            created_at=p.created_at,
        ))
    return items


@router.get("/api/blog/{slug}", response_model=PublicBlogDetail)
def public_blog_detail(slug: str, lang: str = Query("ja"), db: Session = Depends(get_db)):
    post = db.query(BlogPost).filter(BlogPost.slug == slug, BlogPost.status == "published").first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog not found")
    tr = _translate_blog(db, post, lang) if lang != "ja" else None
    return PublicBlogDetail(
        id=str(post.id),
        title=tr.title if tr else post.title,
        slug=post.slug,
        body=tr.body if tr else post.body,
        excerpt=tr.excerpt if tr else post.excerpt,
        image_url=post.image_url,
        seo_keywords=tr.seo_keywords if tr else post.seo_keywords,
        published_at=post.published_at,
        created_at=post.created_at,
    )


# ──────────────── Founder Management ────────────────

FOUNDER_FREE_LIMIT = int(os.getenv("FOUNDER_FREE_LIMIT", "200"))
SITE_URL = os.getenv("SITE_URL", "https://carat-community.com")


class FounderItem(BaseModel):
    id: int
    founder_code: str
    display_name: str
    is_active: bool
    max_invites: Optional[int] = None
    referral_count: int = 0
    referral_url: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FounderListResponse(BaseModel):
    items: List[FounderItem]
    total_founder_free_members: int
    founder_free_limit: int


class FounderCreateRequest(BaseModel):
    founder_code: str
    display_name: str
    is_active: bool = True
    max_invites: Optional[int] = None


class FounderUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    is_active: Optional[bool] = None
    max_invites: Optional[int] = None


@router.get("/api/admin/founders", response_model=FounderListResponse)
def list_founders(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    founders = db.query(Founder).order_by(Founder.id).all()
    total_founder_free = db.query(User).filter(
        User.is_founder_free_member == True,
        User.deleted_at.is_(None),
    ).count()

    items = []
    for f in founders:
        count = db.query(Referral).filter(Referral.founder_code == f.founder_code).count()
        items.append(FounderItem(
            id=f.id,
            founder_code=f.founder_code,
            display_name=f.display_name,
            is_active=f.is_active,
            max_invites=f.max_invites,
            referral_count=count,
            referral_url=f"{SITE_URL}/register?ref={f.founder_code}",
            created_at=f.created_at,
            updated_at=f.updated_at,
        ))
    return FounderListResponse(
        items=items,
        total_founder_free_members=total_founder_free,
        founder_free_limit=FOUNDER_FREE_LIMIT,
    )


@router.post("/api/admin/founders")
def create_founder(
    body: FounderCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    existing = db.query(Founder).filter(Founder.founder_code == body.founder_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Founder code already exists")
    founder = Founder(
        founder_code=body.founder_code,
        display_name=body.display_name,
        is_active=body.is_active,
        max_invites=body.max_invites,
    )
    db.add(founder)
    db.commit()
    db.refresh(founder)
    _write_audit(db, current_user.id, "FOUNDER_CREATE", request,
                 target_type="founder", target_id=str(founder.id),
                 metadata={"founder_code": body.founder_code})
    return {"ok": True, "id": founder.id, "founder_code": founder.founder_code}


@router.put("/api/admin/founders/{founder_id}")
def update_founder(
    founder_id: int,
    body: FounderUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    founder = db.query(Founder).filter(Founder.id == founder_id).first()
    if not founder:
        raise HTTPException(status_code=404, detail="Founder not found")
    updates = {}
    if body.display_name is not None:
        founder.display_name = body.display_name
        updates["display_name"] = body.display_name
    if body.is_active is not None:
        founder.is_active = body.is_active
        updates["is_active"] = body.is_active
    if body.max_invites is not None:
        founder.max_invites = body.max_invites
        updates["max_invites"] = body.max_invites
    db.commit()
    db.refresh(founder)
    _write_audit(db, current_user.id, "FOUNDER_UPDATE", request,
                 target_type="founder", target_id=str(founder.id), metadata=updates)
    return {"ok": True, "founder_code": founder.founder_code}


@router.get("/api/admin/founders/{founder_id}/qr")
def get_founder_qr(
    founder_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    founder = db.query(Founder).filter(Founder.id == founder_id).first()
    if not founder:
        raise HTTPException(status_code=404, detail="Founder not found")
    url = f"{SITE_URL}/register?ref={founder.founder_code}"
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        import base64
        b64 = base64.b64encode(buf.read()).decode()
        return {"url": url, "qr_data_url": f"data:image/png;base64,{b64}"}
    except ImportError:
        return {"url": url, "qr_data_url": None, "error": "qrcode library not installed"}


# ──────────────── Ambassadors (Paid Referral) ────────────────

class AmbassadorItem(BaseModel):
    id: int
    ambassador_code: str
    display_name: str
    is_active: bool
    max_invites: Optional[int] = None
    referral_count: int = 0
    referral_url: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AmbassadorListResponse(BaseModel):
    items: List[AmbassadorItem]
    total_paid_referrals: int


class AmbassadorCreateRequest(BaseModel):
    ambassador_code: str
    display_name: str
    is_active: bool = True
    max_invites: Optional[int] = None


class AmbassadorUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    is_active: Optional[bool] = None
    max_invites: Optional[int] = None


@router.get("/api/admin/ambassadors", response_model=AmbassadorListResponse)
def list_ambassadors(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    ambassadors = db.query(Ambassador).order_by(Ambassador.id).all()
    total_paid = db.query(Referral).filter(
        Referral.ambassador_code.isnot(None),
    ).count()

    items = []
    for a in ambassadors:
        count = db.query(Referral).filter(Referral.ambassador_code == a.ambassador_code).count()
        items.append(AmbassadorItem(
            id=a.id,
            ambassador_code=a.ambassador_code,
            display_name=a.display_name,
            is_active=a.is_active,
            max_invites=a.max_invites,
            referral_count=count,
            referral_url=f"{SITE_URL}/register?ref={a.ambassador_code}",
            created_at=a.created_at,
            updated_at=a.updated_at,
        ))
    return AmbassadorListResponse(
        items=items,
        total_paid_referrals=total_paid,
    )


@router.post("/api/admin/ambassadors")
def create_ambassador(
    body: AmbassadorCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    existing = db.query(Ambassador).filter(Ambassador.ambassador_code == body.ambassador_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ambassador code already exists")
    ambassador = Ambassador(
        ambassador_code=body.ambassador_code,
        display_name=body.display_name,
        is_active=body.is_active,
        max_invites=body.max_invites,
    )
    db.add(ambassador)
    db.commit()
    db.refresh(ambassador)
    _write_audit(db, current_user.id, "AMBASSADOR_CREATE", request,
                 target_type="ambassador", target_id=str(ambassador.id),
                 metadata={"ambassador_code": body.ambassador_code})
    return {"ok": True, "id": ambassador.id, "ambassador_code": ambassador.ambassador_code}


@router.put("/api/admin/ambassadors/{ambassador_id}")
def update_ambassador(
    ambassador_id: int,
    body: AmbassadorUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    ambassador = db.query(Ambassador).filter(Ambassador.id == ambassador_id).first()
    if not ambassador:
        raise HTTPException(status_code=404, detail="Ambassador not found")
    updates = {}
    if body.display_name is not None:
        ambassador.display_name = body.display_name
        updates["display_name"] = body.display_name
    if body.is_active is not None:
        ambassador.is_active = body.is_active
        updates["is_active"] = body.is_active
    if body.max_invites is not None:
        ambassador.max_invites = body.max_invites
        updates["max_invites"] = body.max_invites
    db.commit()
    db.refresh(ambassador)
    _write_audit(db, current_user.id, "AMBASSADOR_UPDATE", request,
                 target_type="ambassador", target_id=str(ambassador.id), metadata=updates)
    return {"ok": True, "ambassador_code": ambassador.ambassador_code}


@router.get("/api/admin/ambassadors/{ambassador_id}/qr")
def get_ambassador_qr(
    ambassador_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    ambassador = db.query(Ambassador).filter(Ambassador.id == ambassador_id).first()
    if not ambassador:
        raise HTTPException(status_code=404, detail="Ambassador not found")
    url = f"{SITE_URL}/register?ref={ambassador.ambassador_code}"
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        import base64
        b64 = base64.b64encode(buf.read()).decode()
        return {"url": url, "qr_data_url": f"data:image/png;base64,{b64}"}
    except ImportError:
        return {"url": url, "qr_data_url": None, "error": "qrcode library not installed"}


# ──────────────── Referral List ────────────────

class ReferralListItem(BaseModel):
    id: int
    user_id: int
    user_display_name: str = ""
    user_email: str = ""
    founder_code: Optional[str] = None
    founder_display_name: Optional[str] = None
    ambassador_code: Optional[str] = None
    ambassador_display_name: Optional[str] = None
    ref_code: str = ""
    membership_type: str = ""
    status: str = "registered"
    registered_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class ReferralListResponse(BaseModel):
    items: List[ReferralListItem]
    total: int
    page: int
    page_size: int


@router.get("/api/admin/referrals", response_model=ReferralListResponse)
def list_referrals(
    founder_code: str = "",
    date_from: str = "",
    date_to: str = "",
    query: str = "",
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(Referral).join(User, Referral.user_id == User.id)
    if founder_code:
        q = q.filter(Referral.founder_code == founder_code)
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            q = q.filter(Referral.created_at >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            q = q.filter(Referral.created_at <= dt)
        except ValueError:
            pass
    if query:
        pattern = f"%{query}%"
        q = q.filter(or_(User.display_name.ilike(pattern), User.email.ilike(pattern)))
    total = q.count()
    refs = q.order_by(Referral.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # Cache founder display names
    founder_names: dict[str, str] = {}
    for f in db.query(Founder).all():
        founder_names[f.founder_code] = f.display_name
    ambassador_names: dict[str, str] = {}
    for a in db.query(Ambassador).all():
        ambassador_names[a.ambassador_code] = a.display_name

    items = []
    for r in refs:
        user = r.user
        items.append(ReferralListItem(
            id=r.id,
            user_id=r.user_id,
            user_display_name=user.display_name if user else "",
            user_email=user.email if user else "",
            founder_code=r.founder_code,
            founder_display_name=founder_names.get(r.founder_code or "", None),
            ambassador_code=getattr(r, 'ambassador_code', None),
            ambassador_display_name=ambassador_names.get(getattr(r, 'ambassador_code', '') or '', None),
            ref_code=r.ref_code,
            membership_type=user.membership_type if user else "",
            status=r.status or "registered",
            registered_at=r.registered_at,
            created_at=r.created_at,
        ))
    return ReferralListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/api/admin/referrals/csv")
def export_referrals_csv(
    founder_code: str = "",
    date_from: str = "",
    date_to: str = "",
    query: str = "",
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(Referral).join(User, Referral.user_id == User.id)
    if founder_code:
        q = q.filter(Referral.founder_code == founder_code)
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            q = q.filter(Referral.created_at >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            q = q.filter(Referral.created_at <= dt)
        except ValueError:
            pass
    if query:
        pattern = f"%{query}%"
        q = q.filter(or_(User.display_name.ilike(pattern), User.email.ilike(pattern)))
    refs = q.order_by(Referral.created_at.desc()).all()

    founder_names: dict[str, str] = {}
    for f in db.query(Founder).all():
        founder_names[f.founder_code] = f.display_name

    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "登録日", "表示名", "メール", "紹介コード", "紹介元表示名", "会員種別", "ステータス"])
    for r in refs:
        user = r.user
        writer.writerow([
            r.id,
            r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            user.display_name if user else "",
            user.email if user else "",
            r.founder_code or "",
            founder_names.get(r.founder_code or "", ""),
            user.membership_type if user else "",
            r.status or "registered",
        ])

    from starlette.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=referrals.csv"},
    )


# ──────────────── Referral Validation (Public) ────────────────

@router.get("/api/referrals/validate")
def validate_referral(ref: str = "", db: Session = Depends(get_db)):
    """Validate a referral code. Checks founder codes first, then ambassador codes."""
    if not ref:
        return {"valid": False, "reason": "no_code"}

    # Check founder codes first
    founder = db.query(Founder).filter(Founder.founder_code == ref).first()
    if founder:
        if not founder.is_active:
            return {"valid": False, "reason": "inactive_code"}

        total_founder_free = db.query(User).filter(
            User.is_founder_free_member == True,
            User.deleted_at.is_(None),
        ).count()

        if total_founder_free >= FOUNDER_FREE_LIMIT:
            return {
                "valid": False,
                "reason": "cap_reached",
                "founder_display_name": founder.display_name,
                "total": total_founder_free,
                "limit": FOUNDER_FREE_LIMIT,
            }

        return {
            "valid": True,
            "ref_type": "founder",
            "founder_code": founder.founder_code,
            "founder_display_name": founder.display_name,
            "remaining": FOUNDER_FREE_LIMIT - total_founder_free,
            "total": total_founder_free,
            "limit": FOUNDER_FREE_LIMIT,
        }

    # Check ambassador codes
    ambassador = db.query(Ambassador).filter(Ambassador.ambassador_code == ref).first()
    if ambassador:
        if not ambassador.is_active:
            return {"valid": False, "reason": "inactive_code"}
        return {
            "valid": True,
            "ref_type": "ambassador",
            "ambassador_code": ambassador.ambassador_code,
            "ambassador_display_name": ambassador.display_name,
        }

    return {"valid": False, "reason": "invalid_code"}


# ──────────────── Founder Status (Public) ────────────────

@router.get("/api/founder/quota")
def founder_quota(db: Session = Depends(get_db)):
    """Public endpoint showing founder free member quota."""
    total_founder_free = db.query(User).filter(
        User.is_founder_free_member == True,
        User.deleted_at.is_(None),
    ).count()
    return {
        "total": total_founder_free,
        "limit": FOUNDER_FREE_LIMIT,
        "remaining": max(0, FOUNDER_FREE_LIMIT - total_founder_free),
        "cap_reached": total_founder_free >= FOUNDER_FREE_LIMIT,
        "accepting": total_founder_free < FOUNDER_FREE_LIMIT,
    }


# ── Salon Management (Admin) ──────────────────────────────────

VALID_COMMUNITY_CATEGORIES = [
    'ゲイ', 'レズビアン', 'バイセクシュアル', 'トランスジェンダー',
    'クィア', 'ストレート・アライ', 'その他', 'ALL',
]


class SalonRoomItem(BaseModel):
    id: int
    theme: str
    room_type: str
    target_identities: list
    is_active: bool
    creator_display_name: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class SalonRoomListResponse(BaseModel):
    items: List[SalonRoomItem]
    total: int


class SalonRoomUpdateCategories(BaseModel):
    target_identities: List[str]


@router.get("/api/auth/admin/salon-rooms")
def admin_list_salon_rooms(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Admin: list all salon rooms with their categories."""
    q = db.query(SalonRoom).order_by(SalonRoom.created_at.desc())
    total = q.count()
    rooms = q.offset((page - 1) * size).limit(size).all()
    items = []
    for room in rooms:
        creator = db.query(User).filter(User.id == room.creator_id).first()
        items.append({
            "id": room.id,
            "theme": room.theme,
            "room_type": room.room_type,
            "target_identities": room.target_identities or [],
            "is_active": room.is_active,
            "creator_display_name": creator.display_name if creator else None,
            "created_at": room.created_at.isoformat() if room.created_at else None,
        })
    return {"items": items, "total": total}


@router.put("/api/auth/admin/salon-rooms/{room_id}/categories")
def admin_update_salon_categories(
    room_id: int,
    body: SalonRoomUpdateCategories,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Admin: update target_identities (allowed community categories) for a salon room."""
    room = db.query(SalonRoom).filter(SalonRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salon room not found")
    for cat in body.target_identities:
        if cat not in VALID_COMMUNITY_CATEGORIES:
            raise HTTPException(status_code=422, detail=f"Invalid category: {cat}")
    room.target_identities = body.target_identities
    db.commit()
    db.refresh(room)
    _write_audit(db, admin.id, "update_salon_categories", request,
                 target_type="salon_room", target_id=str(room_id),
                 metadata={"target_identities": body.target_identities})
    return {"id": room.id, "target_identities": room.target_identities}


@router.post("/api/admin/blog/notify-all-to-google")
def notify_all_blogs_to_google(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """
    Notify Google Indexing API about all published blog posts.
    Use this to bulk-index existing blog posts.
    """
    try:
        # Get all published blog posts
        published_blogs = db.query(BlogPost).filter(
            BlogPost.status == "published"
        ).all()
        
        logger.info(f"Found {len(published_blogs)} published blog posts to notify")
        
        indexing_service = get_indexing_service()
        success_count = 0
        error_count = 0
        errors = []
        
        for blog in published_blogs:
            blog_url = f"https://carat-community.com/blog/{blog.slug}"
            try:
                result = indexing_service.notify_url_updated(blog_url)
                if result:
                    logger.info(f"Notified Google Indexing API: {blog_url}")
                    success_count += 1
                else:
                    logger.warning(f"Failed to notify: {blog_url}")
                    error_count += 1
                    errors.append({"url": blog_url, "error": "API returned False"})
            except Exception as e:
                logger.error(f"Error notifying {blog_url}: {e}")
                error_count += 1
                errors.append({"url": blog_url, "error": str(e)})
        
        _write_audit(
            db, 
            current_user.id, 
            "NOTIFY_ALL_BLOGS_TO_GOOGLE", 
            request,
            metadata={
                "total": len(published_blogs),
                "success": success_count,
                "errors": error_count
            }
        )
        
        return {
            "total_blogs": len(published_blogs),
            "success_count": success_count,
            "error_count": error_count,
            "errors": errors[:10] if errors else []  # Return first 10 errors only
        }
        
    except Exception as e:
        logger.error(f"Failed to notify all blogs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to notify blogs: {str(e)}")


# ──────────────── All Users Including Unverified ────────────────

@router.get("/api/admin/all-users-debug")
def list_all_users_debug(
    days: int = 14,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List ALL users including unverified, for debugging (admin only)"""
    from datetime import datetime, timedelta
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Query ALL users (including unverified, no deleted_at filter initially)
    users = db.query(User).filter(
        User.created_at >= cutoff_date
    ).order_by(User.created_at.desc()).all()
    
    # Get referral info
    user_ids = [u.id for u in users]
    referrals = {}
    if user_ids:
        for ref in db.query(Referral).filter(Referral.user_id.in_(user_ids)).all():
            referrals[ref.user_id] = ref
    
    result = []
    for user in users:
        ref = referrals.get(user.id)
        
        result.append({
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "subscription_status": user.subscription_status,
            "account_status": user.account_status,
            "membership_type": user.membership_type,
            "is_founder_free_member": user.is_founder_free_member,
            "email_verified": user.email_verified,
            "kyc_status": user.kyc_status,
            "is_active": user.is_active,
            "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "referral_code": ref.founder_code or ref.ambassador_code if ref else None,
            "referral_type": "founder" if (ref and ref.founder_code) else ("ambassador" if (ref and ref.ambassador_code) else None),
            "referral_status": ref.status if ref else None
        })
    
    # Statistics
    stats = {
        "total": len(result),
        "email_verified": sum(1 for u in result if u["email_verified"]),
        "email_unverified": sum(1 for u in result if not u["email_verified"]),
        "kyc_verified": sum(1 for u in result if u["kyc_status"] == "VERIFIED"),
        "kyc_pending": sum(1 for u in result if u["kyc_status"] in ["PENDING", "REQUIRES_INPUT"]),
        "kyc_none": sum(1 for u in result if not u["kyc_status"]),
        "active": sum(1 for u in result if u["is_active"]),
        "inactive": sum(1 for u in result if not u["is_active"]),
        "deleted": sum(1 for u in result if u["deleted_at"]),
        "founder_referrals": sum(1 for u in result if u["referral_type"] == "founder"),
        "ambassador_referrals": sum(1 for u in result if u["referral_type"] == "ambassador"),
        "no_referral": sum(1 for u in result if not u["referral_type"]),
        "by_account_status": {},
        "by_subscription_status": {}
    }
    
    for user in result:
        acc_status = user["account_status"] or "unknown"
        sub_status = user["subscription_status"] or "unknown"
        stats["by_account_status"][acc_status] = stats["by_account_status"].get(acc_status, 0) + 1
        stats["by_subscription_status"][sub_status] = stats["by_subscription_status"].get(sub_status, 0) + 1
    
    return {
        "cutoff_date": cutoff_date.isoformat(),
        "statistics": stats,
        "users": result
    }


# ──────────────── Recent Users List ────────────────

@router.get("/api/admin/recent-users")
def list_recent_users(
    days: int = 14,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List users registered in the last N days (admin only)"""
    from datetime import datetime, timedelta
    from sqlalchemy import and_
    
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
            "account_status": user.account_status,
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
    ref_counts = {"founder": 0, "ambassador": 0, "ambassador_paid": 0, "none": 0}
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
            if ref_type == "ambassador" and user_data["referral"]["status"] == "paid":
                ref_counts["ambassador_paid"] += 1
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
