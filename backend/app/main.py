from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from .database import get_db
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.routers import auth, users, profiles, posts, comments, reactions, follows, notifications, media, billing, matching, categories, ops, account, donation, salon, flea_market, jewelry, live_wedding, art_sales, courses, translations, stripe_billing, ogp, contact, admin, founder, moderation
from app.database import Base, engine, get_db
import os
from pathlib import Path
import os
from sqlalchemy import text

PORT = int(os.getenv("PORT", 8000))

app = FastAPI(title="LGBTQ Community API", version="1.0.1")


def _seed_admin_user(db):
    from app.models import User as UserModel
    from app.auth import get_password_hash
    seed_email = os.getenv("ADMIN_SEED_EMAIL", "ted@carat-community.com")
    seed_pass = os.getenv("ADMIN_SEED_PASSWORD", "")
    if not seed_pass:
        return
    existing = db.query(UserModel).filter(UserModel.email == seed_email).first()
    if existing:
        changed = False
        if getattr(existing, "role", "user") != "admin":
            existing.role = "admin"
            existing.membership_type = "admin"
            changed = True
        if getattr(existing, "deleted_at", None) is not None:
            existing.deleted_at = None
            existing.is_active = True
            changed = True
        if not getattr(existing, "is_active", True):
            existing.is_active = True
            changed = True
        existing.password_hash = get_password_hash(seed_pass)
        changed = True
        if changed:
            try:
                db.commit()
                print(f"✅ Restored/promoted {seed_email} to admin")
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed restoring admin: {e}")
        return
    try:
        admin_user = UserModel(
            email=seed_email,
            password_hash=get_password_hash(seed_pass),
            display_name="Admin",
            membership_type="admin",
            role="admin",
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        print(f"✅ Seeded admin user: {seed_email}")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Failed seeding admin: {e}")


def _seed_founders(db):
    """Seed 10 initial founder codes (Ca01-Ca10) if not already present."""
    # Force redeployment to ensure founders are seeded - 2026-04-12
    try:
        existing = db.execute(text("SELECT COUNT(*) FROM founders")).scalar()
        if existing >= 10:
            print("✅ Founders already seeded")
            return
        for i in range(1, 11):
            code = f"Ca{i:02d}"
            name = f"創業メンバー{i:02d}"
            db.execute(
                text(
                    "INSERT INTO founders (founder_code, display_name, is_active) "
                    "VALUES (:code, :name, TRUE) ON CONFLICT (founder_code) DO NOTHING"
                ),
                {"code": code, "name": name},
            )
        db.commit()
        print("✅ Seeded 10 founder codes (Ca01-Ca10)")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Failed seeding founders: {e}")


def _seed_ambassadors(db):
    """Seed 10 initial ambassador codes (Pa01-Pa10) for paid member recruitment."""
    try:
        existing = db.execute(text("SELECT COUNT(*) FROM ambassadors")).scalar()
        if existing >= 10:
            print("✅ Ambassadors already seeded")
            return
        for i in range(1, 11):
            code = f"Pa{i:02d}"
            name = f"有料会員紹介{i:02d}"
            db.execute(
                text(
                    "INSERT INTO ambassadors (ambassador_code, display_name, is_active) "
                    "VALUES (:code, :name, TRUE) ON CONFLICT (ambassador_code) DO NOTHING"
                ),
                {"code": code, "name": name},
            )
        db.commit()
        print("✅ Seeded 10 ambassador codes (Pa01-Pa10)")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Failed seeding ambassadors: {e}")


@app.on_event("startup")
def run_migrations():
    """Run database migrations on startup"""
    try:
        db = next(get_db())

        def _table_exists(table_name: str) -> bool:
            result = db.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = :table_name
                    LIMIT 1
                    """
                ),
                {"table_name": table_name},
            )
            return result.fetchone() is not None

        def _is_base_table(table_name: str) -> bool:
            result = db.execute(
                text(
                    """
                    SELECT 1
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public'
                      AND c.relname = :table_name
                      AND c.relkind = 'r'
                    LIMIT 1
                    """
                ),
                {"table_name": table_name},
            )
            return result.fetchone() is not None

        def _column_exists(table_name: str, column_name: str) -> bool:
            result = db.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = :table_name
                      AND column_name = :column_name
                    LIMIT 1
                    """
                ),
                {"table_name": table_name, "column_name": column_name},
            )
            return result.fetchone() is not None

        def _add_column_if_missing(table_name: str, column_name: str, column_ddl: str) -> None:
            if not _is_base_table(table_name):
                print(f"ℹ️ Skipping {table_name}.{column_name}: '{table_name}' is not a base table")
                return
            try:
                db.execute(
                    text(
                        f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {column_ddl}"
                    )
                )
                db.commit()
                print(f"✅ Ensured column exists: {table_name}.{column_name}")
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed ensuring column {table_name}.{column_name}: {e}")
        # Migration 1: Add phone_number column to users table
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='phone_number'
        """))
        if not result.fetchone():
            db.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(20)"))
            db.commit()
            print("✅ Successfully added phone_number column to users table")
        else:
            print("✅ phone_number column already exists")

        if _table_exists("users"):
            _add_column_if_missing("users", "real_name", "VARCHAR(100)")
            _add_column_if_missing("users", "is_verified", "BOOLEAN DEFAULT FALSE")
            _add_column_if_missing("users", "two_factor_enabled", "BOOLEAN DEFAULT FALSE")
            _add_column_if_missing("users", "two_factor_secret", "VARCHAR(255)")
            _add_column_if_missing("users", "carats", "INTEGER DEFAULT 0")
            _add_column_if_missing("users", "stripe_customer_id", "VARCHAR(255)")
            _add_column_if_missing("users", "stripe_subscription_id", "VARCHAR(255)")
            _add_column_if_missing("users", "subscription_status", "VARCHAR(50)")
            _add_column_if_missing("users", "kyc_status", "VARCHAR(50) DEFAULT 'UNVERIFIED'")
            _add_column_if_missing("users", "stripe_identity_verification_session_id", "VARCHAR(255)")
            _add_column_if_missing("users", "is_legacy_paid", "BOOLEAN DEFAULT FALSE")
            _add_column_if_missing("users", "preferred_lang", "VARCHAR(10) DEFAULT 'ja'")
            _add_column_if_missing("users", "residence_country", "VARCHAR(10)")
            _add_column_if_missing("users", "terms_accepted_at", "TIMESTAMPTZ")
            _add_column_if_missing("users", "terms_version", "VARCHAR(50)")
            _add_column_if_missing("users", "password_reset_token_hash", "VARCHAR(64)")
            _add_column_if_missing("users", "password_reset_expires", "TIMESTAMPTZ")
            _add_column_if_missing("users", "email_verified", "BOOLEAN DEFAULT FALSE")
            _add_column_if_missing("users", "email_verification_token_hash", "VARCHAR(64)")
            _add_column_if_missing("users", "email_verification_expires", "TIMESTAMPTZ")
            _add_column_if_missing("users", "account_status", "VARCHAR(30) DEFAULT 'pending_email'")
            _add_column_if_missing("users", "real_name_kanji", "VARCHAR(200)")
            _add_column_if_missing("users", "birthdate", "DATE")
            _add_column_if_missing("users", "verified_name", "VARCHAR(200)")
            _add_column_if_missing("users", "verified_birthdate", "DATE")
            _add_column_if_missing("users", "identity_verified_at", "TIMESTAMPTZ")
            _add_column_if_missing("users", "identity_verification_method", "VARCHAR(50)")
            _add_column_if_missing("users", "identity_retry_count", "INTEGER DEFAULT 0")
            _add_column_if_missing("users", "identity_document_type", "VARCHAR(50)")
            _add_column_if_missing("users", "card_required", "BOOLEAN DEFAULT TRUE")
            _add_column_if_missing("users", "card_registered", "BOOLEAN DEFAULT FALSE")
        
        if _table_exists("posts"):
            _add_column_if_missing("posts", "category", "VARCHAR")
            _add_column_if_missing("posts", "subcategory", "VARCHAR")
            _add_column_if_missing("posts", "post_type", "VARCHAR")
            _add_column_if_missing("posts", "slug", "VARCHAR")
            _add_column_if_missing("posts", "status", "VARCHAR")
            _add_column_if_missing("posts", "og_image_url", "VARCHAR")
            _add_column_if_missing("posts", "excerpt", "TEXT")
            _add_column_if_missing("posts", "goal_amount", "INTEGER")
            _add_column_if_missing("posts", "current_amount", "INTEGER")
            _add_column_if_missing("posts", "deadline", "DATE")
            _add_column_if_missing("posts", "original_lang", "VARCHAR")

            try:
                if _column_exists("posts", "post_type"):
                    db.execute(text("UPDATE posts SET post_type = 'post' WHERE post_type IS NULL"))
                if _column_exists("posts", "status"):
                    db.execute(text("UPDATE posts SET status = 'published' WHERE status IS NULL"))
                db.commit()
                print("✅ Backfilled posts.post_type/status defaults where NULL")
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed backfilling posts defaults: {e}")
        else:
            print("⚠️ posts table not found in information_schema.tables")

        if not _table_exists("post_media"):
            try:
                db.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS post_media (
                            post_id INTEGER NOT NULL,
                            media_asset_id INTEGER NOT NULL,
                            order_index INTEGER NOT NULL DEFAULT 0,
                            PRIMARY KEY (post_id, media_asset_id),
                            CONSTRAINT fk_post_media_post_id FOREIGN KEY(post_id) REFERENCES posts(id),
                            CONSTRAINT fk_post_media_media_asset_id FOREIGN KEY(media_asset_id) REFERENCES media_assets(id)
                        )
                        """
                    )
                )
                db.commit()
                print("✅ Ensured table exists: post_media")
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed ensuring table post_media: {e}")
        else:
            print("✅ post_media table already exists")

        for tbl_name, tbl_ddl in [
            ("post_translations", """
                CREATE TABLE IF NOT EXISTS post_translations (
                    id SERIAL PRIMARY KEY,
                    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                    lang VARCHAR(10) NOT NULL,
                    translated_title VARCHAR(200),
                    translated_text TEXT NOT NULL,
                    provider VARCHAR(50) NOT NULL DEFAULT 'openai',
                    error_code VARCHAR(50),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_post_translation_lang UNIQUE (post_id, lang)
                )
            """),
            ("comment_translations", """
                CREATE TABLE IF NOT EXISTS comment_translations (
                    id SERIAL PRIMARY KEY,
                    comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
                    lang VARCHAR(10) NOT NULL,
                    translated_text TEXT NOT NULL,
                    provider VARCHAR(50) NOT NULL DEFAULT 'openai',
                    error_code VARCHAR(50),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_comment_translation_lang UNIQUE (comment_id, lang)
                )
            """),
            ("message_translations", """
                CREATE TABLE IF NOT EXISTS message_translations (
                    id SERIAL PRIMARY KEY,
                    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                    lang VARCHAR(10) NOT NULL,
                    translated_text TEXT NOT NULL,
                    provider VARCHAR(50) NOT NULL DEFAULT 'openai',
                    error_code VARCHAR(50),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_message_translation_lang UNIQUE (message_id, lang)
                )
            """),
            ("salon_message_translations", """
                CREATE TABLE IF NOT EXISTS salon_message_translations (
                    id SERIAL PRIMARY KEY,
                    salon_message_id INTEGER NOT NULL REFERENCES salon_messages(id) ON DELETE CASCADE,
                    lang VARCHAR(10) NOT NULL,
                    translated_text TEXT NOT NULL,
                    provider VARCHAR(50) NOT NULL DEFAULT 'openai',
                    error_code VARCHAR(50),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_salon_message_translation_lang UNIQUE (salon_message_id, lang)
                )
            """),
        ]:
            if not _table_exists(tbl_name):
                try:
                    db.execute(text(tbl_ddl))
                    db.commit()
                    print(f"✅ Created table: {tbl_name}")
                except Exception as e:
                    db.rollback()
                    print(f"⚠️ Failed creating table {tbl_name}: {e}")
            else:
                print(f"✅ {tbl_name} table already exists")

        if not _table_exists("contact_inquiries"):
            try:
                db.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS contact_inquiries (
                            id SERIAL PRIMARY KEY,
                            name VARCHAR(200) NOT NULL,
                            email VARCHAR(200) NOT NULL,
                            subject VARCHAR(100) NOT NULL,
                            message TEXT NOT NULL,
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        )
                        """
                    )
                )
                db.commit()
                print("✅ Created table: contact_inquiries")
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed creating table contact_inquiries: {e}")
        else:
            print("✅ contact_inquiries table already exists")

        if _table_exists("users"):
            _add_column_if_missing("users", "role", "VARCHAR(20) DEFAULT 'user'")
            _add_column_if_missing("users", "payment_status", "VARCHAR(30) DEFAULT 'unpaid'")
            _add_column_if_missing("users", "deleted_at", "TIMESTAMPTZ")
            # STEP③: Founder & Referral columns
            _add_column_if_missing("users", "is_founder", "BOOLEAN DEFAULT FALSE")
            _add_column_if_missing("users", "ref_code", "VARCHAR(20) UNIQUE")
            _add_column_if_missing("users", "referred_by_user_id", "INTEGER REFERENCES users(id)")
            # Founder referral system columns
            _add_column_if_missing("users", "subscription_exempt", "BOOLEAN DEFAULT FALSE")
            _add_column_if_missing("users", "is_founder_free_member", "BOOLEAN DEFAULT FALSE")
            _add_column_if_missing("users", "referred_by_founder_code", "VARCHAR(20)")
            _add_column_if_missing("users", "referred_by_ambassador_code", "VARCHAR(20)")
            _add_column_if_missing("users", "ref_code_used", "VARCHAR(20)")
            # Update membership_type constraint to include founder_free.
            # Query pg_constraint to find ALL check constraints on this column,
            # regardless of their name (production may use auto-generated names).
            try:
                rows = db.execute(text(
                    "SELECT con.conname FROM pg_constraint con "
                    "JOIN pg_class rel ON rel.oid = con.conrelid "
                    "WHERE rel.relname = 'users' "
                    "AND con.contype = 'c' "
                    "AND pg_get_constraintdef(con.oid) LIKE '%membership_type%'"
                )).fetchall()
                for row in rows:
                    cname = row[0]
                    db.execute(text(f'ALTER TABLE users DROP CONSTRAINT IF EXISTS "{cname}"'))
                    print(f"✅ Dropped old membership_type constraint: {cname}")
                db.execute(text(
                    "ALTER TABLE users ADD CONSTRAINT check_membership_type "
                    "CHECK (membership_type IN ('free', 'premium', 'admin', 'founder_free'))"
                ))
                db.commit()
                print("✅ Updated membership_type constraint to include founder_free")
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed updating membership_type constraint: {e}")

        # Founders table
        if not _table_exists("founders"):
            try:
                db.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS founders (
                            id SERIAL PRIMARY KEY,
                            founder_code VARCHAR(20) UNIQUE NOT NULL,
                            display_name VARCHAR(100) NOT NULL,
                            is_active BOOLEAN DEFAULT TRUE,
                            max_invites INTEGER,
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        )
                        """
                    )
                )
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_founders_founder_code ON founders(founder_code)"))
                db.commit()
                print("\u2705 Created table: founders")
                # Seed initial 10 founder codes
                _seed_founders(db)
            except Exception as e:
                db.rollback()
                print(f"\u26a0\ufe0f Failed creating table founders: {e}")
        else:
            print("\u2705 founders table already exists")
            # Ensure founders are seeded even if table existed
            _seed_founders(db)

        # Ambassadors table (paid member referral)
        if not _table_exists("ambassadors"):
            try:
                db.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS ambassadors (
                            id SERIAL PRIMARY KEY,
                            ambassador_code VARCHAR(20) UNIQUE NOT NULL,
                            display_name VARCHAR(100) NOT NULL,
                            is_active BOOLEAN DEFAULT TRUE,
                            max_invites INTEGER,
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        )
                        """
                    )
                )
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_ambassadors_ambassador_code ON ambassadors(ambassador_code)"))
                db.commit()
                print("✅ Created table: ambassadors")
                _seed_ambassadors(db)
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed creating table ambassadors: {e}")
        else:
            print("✅ ambassadors table already exists")
            _seed_ambassadors(db)

        # Referrals table - add new columns if exists
        if _table_exists("referrals"):
            _add_column_if_missing("referrals", "founder_code", "VARCHAR(20)")
            _add_column_if_missing("referrals", "ambassador_code", "VARCHAR(20)")
            _add_column_if_missing("referrals", "status", "VARCHAR(20) DEFAULT 'registered'")
            _add_column_if_missing("referrals", "registered_at", "TIMESTAMPTZ DEFAULT NOW()")
            _add_column_if_missing("referrals", "updated_at", "TIMESTAMPTZ DEFAULT NOW()")
            try:
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_referrals_founder_code ON referrals(founder_code)"))
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_referrals_ambassador_code ON referrals(ambassador_code)"))
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed creating index on referrals: {e}")

        # Referrals table
        if not _table_exists("referrals"):
            try:
                db.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS referrals (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id),
                            ref_code VARCHAR(20) NOT NULL,
                            founder_code VARCHAR(20),
                            status VARCHAR(20) DEFAULT 'registered',
                            registered_at TIMESTAMPTZ DEFAULT NOW(),
                            paid_at TIMESTAMPTZ,
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        )
                        """
                    )
                )
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_referrals_user_id ON referrals(user_id)"))
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_referrals_ref_code ON referrals(ref_code)"))
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_referrals_founder_code ON referrals(founder_code)"))
                db.commit()
                print("\u2705 Created table: referrals")
            except Exception as e:
                db.rollback()
                print(f"\u26a0\ufe0f Failed creating table referrals: {e}")
        else:
            print("\u2705 referrals table already exists")

        if not _table_exists("blog_posts"):
            try:
                db.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS blog_posts (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            title VARCHAR(300) NOT NULL,
                            slug VARCHAR(300) UNIQUE NOT NULL,
                            body TEXT NOT NULL,
                            excerpt TEXT,
                            image_url VARCHAR(500),
                            seo_keywords JSONB,
                            status VARCHAR(20) NOT NULL DEFAULT 'draft',
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            published_at TIMESTAMPTZ,
                            created_by_admin_id INTEGER NOT NULL REFERENCES users(id),
                            CONSTRAINT check_blog_status CHECK (status IN ('draft', 'published'))
                        )
                        """
                    )
                )
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_blog_posts_slug ON blog_posts(slug)"))
                db.commit()
                print("\u2705 Created table: blog_posts")
            except Exception as e:
                db.rollback()
                print(f"\u26a0\ufe0f Failed creating table blog_posts: {e}")
        else:
            print("\u2705 blog_posts table already exists")

        if not _table_exists("blog_post_translations"):
            try:
                db.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS blog_post_translations (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            blog_post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
                            language VARCHAR(10) NOT NULL,
                            title VARCHAR(600) NOT NULL,
                            body TEXT NOT NULL,
                            excerpt TEXT,
                            seo_keywords JSONB,
                            created_at TIMESTAMPTZ DEFAULT NOW(),
                            CONSTRAINT uq_blog_translation_post_lang UNIQUE (blog_post_id, language)
                        )
                        """
                    )
                )
                db.commit()
                print("\u2705 Created table: blog_post_translations")
            except Exception as e:
                db.rollback()
                print(f"\u26a0\ufe0f Failed creating table blog_post_translations: {e}")
        else:
            print("\u2705 blog_post_translations table already exists")

        if not _table_exists("audit_logs"):
            try:
                db.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS audit_logs (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            admin_id INTEGER NOT NULL REFERENCES users(id),
                            action VARCHAR(100) NOT NULL,
                            target_type VARCHAR(50),
                            target_id VARCHAR(100),
                            metadata JSONB,
                            ip VARCHAR(50),
                            user_agent VARCHAR(500),
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        )
                        """
                    )
                )
                db.commit()
                print("\u2705 Created table: audit_logs")
            except Exception as e:
                db.rollback()
                print(f"\u26a0\ufe0f Failed creating table audit_logs: {e}")
        else:
            print("\u2705 audit_logs table already exists")

        _seed_admin_user(db)

        # One-time migration: Ensure existing founder_free members have kyc_status='VERIFIED'
        # PR #120 made KYC mandatory for founder_free login. Existing members who registered
        # before this change may have kyc_status='UNVERIFIED', locking them out.
        # Scoped to users created before 2026-04-25 (deploy date) to avoid auto-verifying
        # newly registered members or overriding KYC rejections.
        try:
            result = db.execute(text(
                "UPDATE users SET kyc_status = 'VERIFIED' "
                "WHERE is_founder_free_member = TRUE "
                "AND kyc_status = 'UNVERIFIED' "
                "AND created_at < '2026-04-25T00:00:00Z'"
            ))
            affected = result.rowcount
            db.commit()
            if affected > 0:
                print(f"✅ Updated kyc_status to VERIFIED for {affected} pre-existing founder_free member(s)")
            else:
                print("✅ No pre-existing founder_free members need kyc_status migration")
        except Exception as e:
            db.rollback()
            print(f"⚠️ Failed updating founder_free kyc_status: {e}")

        # One-time migration: Convert 2 test paid members to founder_free (invited via ref=Ca05)
        # These users were registered for billing testing and should be treated as invited guests.
        try:
            result = db.execute(text(
                "UPDATE users "
                "SET membership_type = 'founder_free', "
                "    is_founder_free_member = TRUE, "
                "    subscription_exempt = TRUE, "
                "    referred_by_founder_code = 'Ca05', "
                "    kyc_status = 'VERIFIED' "
                "WHERE email IN (:email1, :email2) "
                "AND membership_type != 'founder_free'"
            ), {"email1": "nichigetsu18@gmail.com", "email2": "ted@carat-community.com"})
            affected = result.rowcount
            db.commit()
            if affected > 0:
                print(f"✅ Converted {affected} test user(s) to founder_free (ref=Ca05)")
            else:
                print("✅ Test users already converted to founder_free or not found")
        except Exception as e:
            db.rollback()
            print(f"⚠️ Failed converting test users to founder_free: {e}")

        # Fix: Ensure converted founder_free test users have email_verified = TRUE
        # (The original conversion migration missed this field, causing login failures)
        try:
            result = db.execute(text(
                "UPDATE users "
                "SET email_verified = TRUE "
                "WHERE email IN (:email1, :email2) "
                "AND (email_verified IS NULL OR email_verified = FALSE)"
            ), {"email1": "nichigetsu18@gmail.com", "email2": "ted@carat-community.com"})
            affected = result.rowcount
            db.commit()
            if affected > 0:
                print(f"✅ Fixed email_verified for {affected} founder_free test user(s)")
            else:
                print("✅ Founder_free test users already have email_verified = TRUE")
        except Exception as e:
            db.rollback()
            print(f"⚠️ Failed fixing email_verified for test users: {e}")

        # Fix: Set account_status='active' for all pre-existing active users.
        # When the account_status column was added with DEFAULT 'pending_email',
        # existing verified users got 'pending_email' and could no longer log in.
        try:
            result = db.execute(text(
                "UPDATE users "
                "SET account_status = 'active', email_verified = TRUE "
                "WHERE is_active = TRUE "
                "AND (account_status IS NULL OR account_status = 'pending_email') "
                "AND created_at < '2026-05-31T00:00:00Z'"
            ))
            affected = result.rowcount
            db.commit()
            if affected > 0:
                print(f"✅ Fixed account_status for {affected} pre-existing active user(s)")
            else:
                print("✅ All active users already have correct account_status")
        except Exception as e:
            db.rollback()
            print(f"⚠️ Failed fixing account_status for existing users: {e}")

        # One-time cleanup: Delete 9 Ca05 test referral records (all test registrations)
        try:
            result = db.execute(text(
                "DELETE FROM referrals "
                "WHERE founder_code = 'Ca05' "
                "AND user_id IN ("
                "  SELECT id FROM users WHERE email IN ("
                "    :e1, :e2, :e3"
                "  )"
                ")"
            ), {
                "e1": "tedueda@icloud.com",
                "e2": "tedueda@ezweb.ne.jp",
                "e3": "studioq0804@gmail.com"
            })
            affected = result.rowcount
            db.commit()
            if affected > 0:
                print(f"✅ Deleted {affected} Ca05 test referral record(s)")
            else:
                print("✅ Ca05 test referral records already cleaned up or not found")
        except Exception as e:
            db.rollback()
            print(f"⚠️ Failed cleaning up Ca05 test referrals: {e}")

        # One-time restore: Reactivate yoshitakabuyoukai@gmail.com (TAKA)
        try:
            result = db.execute(text(
                "UPDATE users SET deleted_at = NULL, is_active = TRUE, "
                "membership_type = 'founder_free', is_founder_free_member = TRUE, "
                "subscription_exempt = TRUE, account_status = 'active', "
                "kyc_status = 'VERIFIED' "
                "WHERE email = :email AND deleted_at IS NOT NULL"
            ), {"email": "yoshitakabuyoukai@gmail.com"})
            affected = result.rowcount
            db.commit()
            if affected > 0:
                print(f"✅ Restored user yoshitakabuyoukai@gmail.com as founder_free")
            else:
                print("✅ yoshitakabuyoukai@gmail.com already active or not found")
        except Exception as e:
            db.rollback()
            print(f"⚠️ Failed restoring yoshitakabuyoukai@gmail.com: {e}")

        # One-time: Create matching profile for TAKA (user_id=130) if missing
        try:
            taka_user = db.execute(text(
                "SELECT id FROM users WHERE email = :email AND deleted_at IS NULL"
            ), {"email": "yoshitakabuyoukai@gmail.com"}).fetchone()
            if taka_user:
                taka_id = taka_user[0]
                existing_prof = db.execute(text(
                    "SELECT user_id FROM matching_profiles WHERE user_id = :uid"
                ), {"uid": taka_id}).fetchone()
                if not existing_prof:
                    db.execute(text(
                        "INSERT INTO matching_profiles "
                        "(user_id, nickname, display_flag, prefecture, age_band, "
                        "identity, community_category, profile_visibility, bio) "
                        "VALUES (:uid, 'TAKA', TRUE, '', '', "
                        "'その他', 'その他', 'public', '')"
                    ), {"uid": taka_id})
                    db.commit()
                    print(f"✅ Created matching profile for TAKA (user_id={taka_id})")
                else:
                    print("✅ TAKA matching profile already exists")
        except Exception as e:
            db.rollback()
            print(f"⚠️ Failed creating TAKA matching profile: {e}")

        # One-time: Delete test users (スタジオ君, Mr.スタジオ, 上田孝久, スタジオキュー)
        try:
            test_user_ids = [103, 107, 127, 128]
            # Check if any test users still exist
            check = db.execute(text(
                "SELECT id FROM users WHERE id IN (103,107,127,128) AND deleted_at IS NULL"
            )).fetchall()
            if check:
                # Delete matching profiles first (FK constraint)
                db.execute(text(
                    "DELETE FROM matching_profiles WHERE user_id IN (103,107,127,128)"
                ))
                # Soft-delete users
                db.execute(text(
                    "UPDATE users SET deleted_at = NOW(), is_active = FALSE "
                    "WHERE id IN (103,107,127,128) AND deleted_at IS NULL"
                ))
                db.commit()
                print(f"✅ Deleted test users: {[r[0] for r in check]}")
            else:
                print("✅ Test users already deleted")
        except Exception as e:
            db.rollback()
            print(f"⚠️ Failed deleting test users: {e}")

        # Migration 2: Add nationality column to matching_profiles table
        if _table_exists("matching_profiles"):
            result = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='matching_profiles' AND column_name='nationality'
            """))
            if not result.fetchone():
                db.execute(text("ALTER TABLE matching_profiles ADD COLUMN nationality VARCHAR(100)"))
                db.commit()
                print("✅ Successfully added nationality column to matching_profiles table")
            else:
                print("✅ nationality column already exists")

        # Migration: Add community_category and position columns to matching_profiles
        if _table_exists("matching_profiles"):
            _add_column_if_missing("matching_profiles", "community_category", "VARCHAR(50)")
            _add_column_if_missing("matching_profiles", "position", "VARCHAR(50)")
            _add_column_if_missing("matching_profiles", "profile_visibility", "VARCHAR(20) NOT NULL DEFAULT 'public'")

        # Data migration: Map old identity values to new community_category
        if _table_exists("matching_profiles") and _column_exists("matching_profiles", "community_category"):
            try:
                # Only migrate rows where community_category is NULL (not yet migrated)
                migrations = [
                    ("ゲイ", "ゲイ"),
                    ("レズ", "レズビアン"),
                    ("レズビアン", "レズビアン"),
                    ("トランスジェンダー", "トランスジェンダー"),
                    ("バイセクシャル", "バイセクシュアル"),
                    ("バイセクシュアル", "バイセクシュアル"),
                    ("クィア", "クィア"),
                    ("男性", "その他"),
                    ("女性", "その他"),
                    ("その他", "その他"),
                    ("非表示", "非公開"),
                    ("非公開", "非公開"),
                    ("gay", "ゲイ"),
                    ("lesbian", "レズビアン"),
                    ("bisexual", "バイセクシュアル"),
                    ("transgender", "トランスジェンダー"),
                    ("questioning", "クィア"),
                    ("other", "その他"),
                ]
                total_migrated = 0
                for old_val, new_val in migrations:
                    result = db.execute(text(
                        "UPDATE matching_profiles SET community_category = :new_val "
                        "WHERE identity = :old_val AND community_category IS NULL"
                    ), {"old_val": old_val, "new_val": new_val})
                    total_migrated += result.rowcount
                db.commit()
                if total_migrated > 0:
                    print(f"✅ Migrated {total_migrated} identity → community_category values")
                else:
                    print("✅ No identity values need migration to community_category")
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed migrating identity to community_category: {e}")

        # One-time cleanup: Delete "スタジオキュー" test referral data
        if _table_exists("referrals") and _table_exists("users"):
            try:
                # Find user IDs for "スタジオキュー" test accounts by email + display_name
                studio_q_users = db.execute(text(
                    "SELECT id FROM users "
                    "WHERE display_name = :name "
                    "AND email IN (:e1, :e2) "
                    "AND deleted_at IS NULL"
                ), {"name": "スタジオキュー", "e1": "tedueda@icloud.com", "e2": "tedyeda@icloud.com"}).fetchall()
                studio_q_ids = [row[0] for row in studio_q_users]
                if studio_q_ids:
                    # Delete referral records for these users
                    ref_result = db.execute(text(
                        "DELETE FROM referrals WHERE user_id = ANY(:ids)"
                    ), {"ids": studio_q_ids})
                    ref_count = ref_result.rowcount
                    # Soft-delete the test user accounts
                    user_result = db.execute(text(
                        "UPDATE users SET deleted_at = NOW() WHERE id = ANY(:ids) AND deleted_at IS NULL"
                    ), {"ids": studio_q_ids})
                    user_count = user_result.rowcount
                    db.commit()
                    if ref_count > 0 or user_count > 0:
                        print(f"✅ Cleaned up スタジオキュー test data: {ref_count} referrals deleted, {user_count} users soft-deleted")
                    else:
                        print("✅ スタジオキュー test data already cleaned up")
                else:
                    print("✅ No スタジオキュー test data found")
            except Exception as e:
                db.rollback()
                print(f"⚠️ Failed cleaning up スタジオキュー test data: {e}")

    except Exception as e:
        print(f"⚠️ Migration error (may be safe to ignore if column exists): {e}")
    finally:
        db.close()

# S3設定 - 開発環境ではローカルストレージを使用
S3_BUCKET = os.getenv("AWS_S3_BUCKET", "rainbow-community-media-prod")
S3_REGION = os.getenv("AWS_REGION", "ap-northeast-1")
USE_S3 = os.getenv("USE_S3", "false").lower() == "true"  # デフォルトfalseに変更

# ローカルメディアディレクトリ（フォールバック）
media_base = os.getenv("MEDIA_DIR")
if not media_base:
    media_base = "/data/media" if os.path.exists("/data") else "media"
MEDIA_DIR = Path(media_base)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

# S3使用時は/media/をS3にリダイレクト、それ以外はローカルファイル
if not USE_S3:
    app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

matching_media_base = os.getenv("MATCHING_MEDIA_DIR")
if not matching_media_base:
    matching_media_base = "/data/matching_media" if os.path.exists("/data") else "matching_media"
MATCHING_MEDIA_DIR = Path(matching_media_base)
MATCHING_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/matching-media", StaticFiles(directory=str(MATCHING_MEDIA_DIR)), name="matching_media")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins_env = os.getenv("ALLOW_ORIGINS", "")
if origins_env:
    ALLOWED_ORIGINS = [o.strip() for o in origins_env.split(",") if o.strip()]
else:
    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://carat-community.com",
        "https://www.carat-community.com",
        "https://tedueda.github.io",
        "https://carat-rainbow-community.netlify.app",
        "https://rainbow-community-app-wg5nxt2r.devinapps.com",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure 307 redirect between with/without trailing slash
app.router.redirect_slashes = True

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(profiles.router)
app.include_router(posts.router)
app.include_router(comments.router)
app.include_router(reactions.router)
app.include_router(follows.router)
app.include_router(notifications.router)
app.include_router(media.router)
app.include_router(billing.router)
app.include_router(matching.router)
app.include_router(categories.router)
app.include_router(ops.router)
app.include_router(account.router)
app.include_router(donation.router)
app.include_router(salon.router)
app.include_router(flea_market.router)
app.include_router(jewelry.router)
app.include_router(live_wedding.router)
app.include_router(art_sales.router)
app.include_router(courses.router)
app.include_router(translations.router)
app.include_router(stripe_billing.router)
app.include_router(ogp.router)
app.include_router(contact.router)
app.include_router(admin.router)
app.include_router(moderation.router)

# サイトマップをルートレベルで配信
@app.get("/sitemap.xml")
def root_sitemap():
    """Root level sitemap endpoint"""
    from fastapi.responses import Response
    from datetime import datetime
    
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        '    <loc>https://carat-community.com/</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>',
        '  <url>',
        '    <loc>https://carat-community.com/feed</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>hourly</changefreq>',
        '    <priority>0.9</priority>',
        '  </url>',
        '  <url>',
        '    <loc>https://carat-community.com/blog</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.9</priority>',
        '  </url>',
        '  <url>',
        '    <loc>https://carat-community.com/matching</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
        '  <url>',
        '    <loc>https://carat-community.com/salon</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
        '  <url>',
        '    <loc>https://carat-community.com/flea-market</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.7</priority>',
        '  </url>',
        '</urlset>',
    ]
    
    return Response(content='\n'.join(xml_lines), media_type="application/xml")

@app.get("/sitemap-blog.xml")
def root_blog_sitemap(db: Session = Depends(get_db)):
    """Root level blog sitemap endpoint"""
    from fastapi.responses import Response
    from backend.app.models import BlogPost
    from datetime import datetime
    
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
app.include_router(founder.router)

@app.on_event("startup")
def on_startup():
    try:
        db_url = os.getenv("DATABASE_URL", "")
        if "sqlite" in db_url.lower() or not db_url:
            Base.metadata.create_all(bind=engine)
        print("✅ Database initialization completed")
    except Exception as e:
        print(f"⚠️ Database initialization failed: {e}")
        print("⚠️ Application will continue without database initialization")

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.head("/healthz")
async def healthz_head():
    return {"status": "ok"}

@app.get("/")
async def root():
    return {"message": "LGBTQ Community API", "version": "1.0.0"}


@app.get("/api/health")
def health(db=Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}


@app.get("/api/debug/env")
def debug_env():
    """環境変数の確認用（デバッグ）"""
    return {
        "USE_S3": USE_S3,
        "S3_BUCKET": S3_BUCKET,
        "S3_REGION": S3_REGION,
        "USE_S3_env": os.getenv("USE_S3"),
        "AWS_S3_BUCKET_env": os.getenv("AWS_S3_BUCKET"),
        "AWS_REGION_env": os.getenv("AWS_REGION")
    }


@app.get("/media/{filename:path}")
async def serve_media(filename: str):
    """S3から画像を取得するためのリダイレクト"""
    if USE_S3:
        s3_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/media/{filename}"
        return RedirectResponse(url=s3_url, status_code=307)
    else:
        # ローカルファイルシステムにフォールバック（StaticFilesでマウント済み）
        raise HTTPException(status_code=404, detail="Media not found")


@app.get("/api/_routes")
def list_routes():
    try:
        return {
            "routes": [
                {
                    "path": getattr(r, "path", None),
                    "name": getattr(r, "name", None),
                    "methods": list(getattr(r, "methods", []) or []),
                }
                for r in app.routes
            ]
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/categories/{name}/posts")
def posts_by_category(name: str, limit: int = 20, offset: int = 0, db=Depends(get_db)):
    sql = text("""
        SELECT id, title, body, created_at
        FROM public.v_posts_by_tag
        WHERE tag = :name
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    rows = db.execute(sql, {"name": name, "limit": limit, "offset": offset}).mappings().all()
    return {"items": rows, "count": len(rows)}
