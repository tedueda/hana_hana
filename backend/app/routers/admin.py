import uuid
import json
import os
import re
import io
import imghdr
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
from app.models import User, BlogPost, AuditLog

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
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "3200"))

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

class UserListItem(BaseModel):
    id: int
    email: str
    display_name: str
    created_at: Optional[datetime] = None
    payment_status: Optional[str] = None
    subscription_status: Optional[str] = None
    is_active: bool = True

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
    db.commit()
    _write_audit(db, current_user.id, "USER_DELETE", request, target_type="user", target_id=str(user_id))
    return {"ok": True}


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
    kind = imghdr.what(None, h=data)
    if kind not in ("jpeg", "png", "webp", "rgb"):
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
                raise HTTPException(status_code=500, detail="Blog generation failed after retries")

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
    _write_audit(db, current_user.id, "BLOG_DELETE", request, target_type="blog", target_id=str(post.id), metadata={"title": post.title})
    db.delete(post)
    db.commit()
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


# ──────────────── Public Blog ────────────────

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
def public_blog_list(db: Session = Depends(get_db)):
    posts = (
        db.query(BlogPost)
        .filter(BlogPost.status == "published")
        .order_by(BlogPost.published_at.desc())
        .all()
    )
    return [
        PublicBlogItem(
            id=str(p.id), title=p.title, slug=p.slug, excerpt=p.excerpt,
            image_url=p.image_url, seo_keywords=p.seo_keywords,
            published_at=p.published_at, created_at=p.created_at,
        )
        for p in posts
    ]


@router.get("/api/blog/{slug}", response_model=PublicBlogDetail)
def public_blog_detail(slug: str, db: Session = Depends(get_db)):
    post = db.query(BlogPost).filter(BlogPost.slug == slug, BlogPost.status == "published").first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog not found")
    return PublicBlogDetail(
        id=str(post.id), title=post.title, slug=post.slug, body=post.body,
        excerpt=post.excerpt, image_url=post.image_url, seo_keywords=post.seo_keywords,
        published_at=post.published_at, created_at=post.created_at,
    )
