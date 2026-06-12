"""Block & Report API endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserBlock, Report
from app.auth import get_current_active_user

router = APIRouter(prefix="/api/moderation", tags=["moderation"])


# --- Block ---

class BlockRequest(BaseModel):
    user_id: int

@router.post("/block")
def block_user(req: BlockRequest, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if req.user_id == current_user.id:
        raise HTTPException(400, "Cannot block yourself")
    existing = db.query(UserBlock).filter(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == req.user_id).first()
    if existing:
        return {"status": "already_blocked"}
    db.add(UserBlock(blocker_id=current_user.id, blocked_id=req.user_id))
    db.commit()
    return {"status": "blocked"}

@router.delete("/block/{user_id}")
def unblock_user(user_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    block = db.query(UserBlock).filter(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id).first()
    if not block:
        raise HTTPException(404, "Block not found")
    db.delete(block)
    db.commit()
    return {"status": "unblocked"}

@router.get("/block/check/{user_id}")
def check_block(user_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    is_blocked = db.query(UserBlock).filter(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id).first() is not None
    return {"is_blocked": is_blocked}

@router.get("/blocks")
def list_blocked_users(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    blocks = db.query(UserBlock, User).join(User, User.id == UserBlock.blocked_id).filter(UserBlock.blocker_id == current_user.id).all()
    return [{"user_id": u.id, "display_name": u.display_name, "blocked_at": b.created_at.isoformat()} for b, u in blocks]


# --- Report ---

class ReportRequest(BaseModel):
    reported_user_id: Optional[int] = None
    content_type: Optional[str] = None
    content_id: Optional[int] = None
    reason: str
    detail: Optional[str] = None

@router.post("/report")
def create_report(req: ReportRequest, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if req.reason not in ('harassment', 'spam', 'inappropriate', 'other'):
        raise HTTPException(400, "Invalid reason")
    report = Report(
        reporter_id=current_user.id,
        reported_user_id=req.reported_user_id,
        content_type=req.content_type,
        content_id=req.content_id,
        reason=req.reason,
        detail=req.detail,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"status": "reported", "report_id": report.id}


# --- Admin Report Management ---

def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.membership_type != "admin":
        raise HTTPException(403, "Admin only")
    return current_user

@router.get("/admin/reports")
def list_reports(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Report)
    if status:
        q = q.filter(Report.status == status)
    total = q.count()
    reports = q.order_by(Report.created_at.desc()).offset((page - 1) * size).limit(size).all()

    items = []
    for r in reports:
        reporter = db.query(User).filter(User.id == r.reporter_id).first()
        reported = db.query(User).filter(User.id == r.reported_user_id).first() if r.reported_user_id else None
        items.append({
            "id": r.id,
            "reporter_id": r.reporter_id,
            "reporter_name": reporter.display_name if reporter else "",
            "reported_user_id": r.reported_user_id,
            "reported_user_name": reported.display_name if reported else "",
            "content_type": r.content_type,
            "content_id": r.content_id,
            "reason": r.reason,
            "detail": r.detail,
            "status": r.status,
            "admin_note": r.admin_note,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })
    return {"items": items, "total": total, "page": page, "size": size}

class UpdateReportRequest(BaseModel):
    status: Optional[str] = None
    admin_note: Optional[str] = None

@router.put("/admin/reports/{report_id}")
def update_report(report_id: int, req: UpdateReportRequest, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    if req.status:
        report.status = req.status
    if req.admin_note is not None:
        report.admin_note = req.admin_note
    db.commit()
    return {"status": "updated"}
