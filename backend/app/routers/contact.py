from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging

from app.database import get_db

logger = logging.getLogger(__name__)

CONTACT_RECIPIENT = os.getenv("CONTACT_EMAIL", "ted@carat-community.com")
SMTP_HOST = os.getenv("SMTP_HOST", "sv14645.xserver.jp")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "ted@carat-community.com")
SMTP_PASS = os.getenv("SMTP_PASS", "ct383138")

router = APIRouter(
    prefix="/api/contact",
    tags=["contact"],
)

SUBJECT_MAP = {
    "service": "サービスについて",
    "account": "アカウントについて",
    "payment": "決済・お支払いについて",
    "bug": "不具合・バグ報告",
    "other": "その他",
}


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str


@router.post("")
def submit_contact(
    payload: ContactRequest,
    db: Session = Depends(get_db),
):
    try:
        db.execute(
            text(
                """
                INSERT INTO contact_inquiries (name, email, subject, message)
                VALUES (:name, :email, :subject, :message)
                """
            ),
            {
                "name": payload.name,
                "email": payload.email,
                "subject": payload.subject,
                "message": payload.message,
            },
        )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Failed to save contact inquiry: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save inquiry")

    try:
        _send_smtp_email(payload)
    except Exception as e:
        logger.warning("Email notification failed: %s", e)

    return {"ok": True}


def _send_smtp_email(payload: ContactRequest) -> None:
    if not SMTP_PASS:
        logger.warning("SMTP_PASS not set, skipping email")
        return

    subject_label = SUBJECT_MAP.get(payload.subject, payload.subject)

    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = CONTACT_RECIPIENT
    msg["Subject"] = f"[Carat お問い合わせ] {subject_label}"
    msg["Reply-To"] = payload.email

    body = (
        f"名前: {payload.name}\n"
        f"メール: {payload.email}\n"
        f"件名: {subject_label}\n\n"
        f"{payload.message}"
    )
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, [CONTACT_RECIPIENT], msg.as_string())

    logger.info("Contact email sent to %s", CONTACT_RECIPIENT)
