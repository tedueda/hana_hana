from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Profile, MatchingProfile, MatchingProfileImage, Post, MediaAsset
from sqlalchemy import text
import os

router = APIRouter(prefix="/api/ops", tags=["ops"])


@router.post("/run_migration")
def run_migration(
    db: Session = Depends(get_db),
    x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret"),
):
    # Safety guard: require both env flag and admin secret header
    if os.getenv("ALLOW_MIGRATION_API", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="migration_api_disabled")
    admin_secret = os.getenv("ADMIN_SECRET")
    if not admin_secret or x_admin_secret != admin_secret:
        raise HTTPException(status_code=401, detail="unauthorized")

    # 1) Columns
    db.execute(text("ALTER TABLE matching_profiles ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)"))
    db.execute(text("ALTER TABLE matching_profiles ADD COLUMN IF NOT EXISTS meeting_style VARCHAR(50)"))

    # 2) Data backfill
    db.execute(text(
        """
        UPDATE matching_profiles
        SET meeting_style = meet_pref
        WHERE meet_pref IS NOT NULL AND meeting_style IS NULL
        """
    ))

    # 3) Images table
    db.execute(text(
        """
        CREATE TABLE IF NOT EXISTS matching_profile_images (
            id SERIAL PRIMARY KEY,
            profile_id INTEGER NOT NULL REFERENCES matching_profiles(user_id) ON DELETE CASCADE,
            image_url VARCHAR(500) NOT NULL,
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT unique_profile_order UNIQUE (profile_id, display_order),
            CONSTRAINT check_order_range CHECK (display_order >= 0 AND display_order < 5)
        )
        """
    ))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_profile_images_profile_id ON matching_profile_images(profile_id)"))

    # 4) Donation tables
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS donation_projects (
            id SERIAL PRIMARY KEY,
            creator_id INTEGER NOT NULL REFERENCES users(id),
            title VARCHAR(200) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(50) NOT NULL,
            goal_amount INTEGER NOT NULL,
            current_amount INTEGER NOT NULL DEFAULT 0,
            deadline DATE NOT NULL,
            supporters_count INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS donation_project_images (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES donation_projects(id) ON DELETE CASCADE,
            image_url VARCHAR(500) NOT NULL,
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS donation_supports (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES donation_projects(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            amount INTEGER NOT NULL,
            message TEXT,
            is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """))
    
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_donation_projects_creator_id ON donation_projects(creator_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_donation_project_images_project_id ON donation_project_images(project_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_donation_supports_project_id ON donation_supports(project_id)"))

    # 5) Posts table funding columns
    db.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS goal_amount INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS current_amount INTEGER DEFAULT 0"))
    db.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS deadline DATE"))

    # 6) Salon categories table + seed data
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS salon_categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            display_name VARCHAR(100) NOT NULL,
            description TEXT,
            group_name VARCHAR(100) NOT NULL,
            icon VARCHAR(50),
            sort_order INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            warning_text TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_salon_categories_id ON salon_categories(id)"))

    # Salon rooms: add new columns if missing
    db.execute(text("ALTER TABLE salon_rooms ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES salon_categories(id)"))
    db.execute(text("ALTER TABLE salon_rooms ADD COLUMN IF NOT EXISTS target_audiences JSON"))
    db.execute(text("ALTER TABLE salon_rooms ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public'"))
    db.execute(text("ALTER TABLE salon_rooms ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500)"))
    db.execute(text("ALTER TABLE salon_rooms ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'"))

    # Salon room tags
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS salon_room_tags (
            id SERIAL PRIMARY KEY,
            room_id INTEGER NOT NULL REFERENCES salon_rooms(id) ON DELETE CASCADE,
            tag_name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_salon_room_tags_id ON salon_room_tags(id)"))

    # Salon posts
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS salon_posts (
            id SERIAL PRIMARY KEY,
            room_id INTEGER NOT NULL REFERENCES salon_rooms(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id),
            content TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_salon_posts_id ON salon_posts(id)"))

    # Salon comments
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS salon_comments (
            id SERIAL PRIMARY KEY,
            post_id INTEGER NOT NULL REFERENCES salon_posts(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id),
            content TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_salon_comments_id ON salon_comments(id)"))

    # Salon reports
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS salon_reports (
            id SERIAL PRIMARY KEY,
            room_id INTEGER REFERENCES salon_rooms(id) ON DELETE SET NULL,
            post_id INTEGER REFERENCES salon_posts(id) ON DELETE SET NULL,
            comment_id INTEGER REFERENCES salon_comments(id) ON DELETE SET NULL,
            reported_by_user_id INTEGER NOT NULL REFERENCES users(id),
            reason TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_salon_reports_id ON salon_reports(id)"))

    # Seed 33 salon categories
    warning_text = "このカテゴリーでは、違法行為の助長、勧誘、売買、露骨な性的表現は禁止されています。安心して相談・情報交換ができる場としてご利用ください。"
    salon_categories = [
        ("music", "音楽", "好きなアーティスト、ライブ、楽曲について語るサロン。", "エンタメ・カルチャー", "🎵", 1, None),
        ("movie", "映画", "映画の感想、おすすめ作品、LGBTQ＋映画、名シーンなどを語るサロン。", "エンタメ・カルチャー", "🎬", 2, None),
        ("drama", "ドラマ", "国内外のドラマの感想、おすすめ作品を語るサロン。", "エンタメ・カルチャー", "📺", 3, None),
        ("anime", "アニメ", "アニメの感想、おすすめ作品、キャラクター考察を語るサロン。", "エンタメ・カルチャー", "🎌", 4, None),
        ("theater", "演劇", "舞台、ミュージカル、演劇の感想や情報を共有するサロン。", "エンタメ・カルチャー", "🎭", 5, None),
        ("kabuki", "歌舞伎", "歌舞伎の演目、役者、鑑賞記録を語るサロン。", "エンタメ・カルチャー", "🏯", 6, None),
        ("nihon_buyo", "日本舞踊", "日本舞踊の魅力、稽古、公演情報を共有するサロン。", "エンタメ・カルチャー", "💃", 7, None),
        ("theme_park", "テーマパーク", "テーマパークの攻略情報、おすすめアトラクションを語るサロン。", "エンタメ・カルチャー", "🎢", 8, None),
        ("game", "ゲーム", "ゲームの攻略、おすすめタイトル、一緒にプレイする仲間を見つけるサロン。", "エンタメ・カルチャー", "🎮", 9, None),
        ("travel", "旅行", "おすすめの旅行先、LGBTQ＋フレンドリーなスポット情報を共有するサロン。", "ライフスタイル", "✈️", 10, None),
        ("gourmet", "グルメ", "おいしいお店、レシピ、食のトレンドを語るサロン。", "ライフスタイル", "🍽️", 11, None),
        ("beauty", "美容", "メイク、スキンケア、脱毛、髪型、自分らしい見た目について語るサロン。", "ライフスタイル", "💄", 12, None),
        ("fashion", "ファッション", "ジェンダーレスファッション、コーデ、ブランド情報を語るサロン。", "ライフスタイル", "👗", 13, None),
        ("pet", "ペット", "ペットの写真、飼育相談、ペット同伴スポットを共有するサロン。", "ライフスタイル", "🐾", 14, None),
        ("animal", "動物", "動物の生態、動物園情報、野生動物の話題を語るサロン。", "ライフスタイル", "🦁", 15, None),
        ("nature", "自然", "自然の美しさ、アウトドア、キャンプ、登山について語るサロン。", "ライフスタイル", "🌿", 16, None),
        ("love_relationship", "愛・人間関係", "恋愛、友情、家族関係、人間関係の悩みを相談・共有するサロン。", "ライフスタイル", "💕", 17, None),
        ("politics", "政治", "政治の話題、選挙、政策について議論するサロン。", "社会・知識", "🏛️", 18, None),
        ("economy", "経済", "経済ニュース、投資、金融の話題を語るサロン。", "社会・知識", "📈", 19, None),
        ("world_affairs", "世界情勢", "国際ニュース、世界の出来事について議論するサロン。", "社会・知識", "🌍", 20, None),
        ("war_peace", "戦争・平和", "戦争と平和について考え、議論するサロン。", "社会・知識", "🕊️", 21, None),
        ("medical_health", "医学・健康", "健康管理、医療情報、メンタルヘルスについて語るサロン。", "社会・知識", "🏥", 22, None),
        ("environment", "環境", "環境問題、エコ活動、サステナビリティについて語るサロン。", "社会・知識", "♻️", 23, None),
        ("ai", "AI", "AI技術、ChatGPT、未来のテクノロジーについて語るサロン。", "社会・知識", "🤖", 24, None),
        ("space", "宇宙", "宇宙探査、天文学、星空観察について語るサロン。", "社会・知識", "🚀", 25, None),
        ("business", "ビジネス", "起業、キャリア、LGBTQ＋フレンドリー企業について語るサロン。", "社会・知識", "💼", 26, None),
        ("school_learning", "スクール・学び", "勉強法、資格取得、学校生活について語るサロン。", "社会・知識", "📚", 27, None),
        ("sex_romance", "SEX・恋愛", "セクシュアリティ、恋愛の悩み、パートナーシップについて語るサロン。", "大人向け・ディープテーマ", "🔥", 28, warning_text),
        ("drug_addiction", "ドラッグ・依存・社会問題", "依存症、社会問題、回復について安心して語れるサロン。", "大人向け・ディープテーマ", "⚠️", 29, warning_text),
        ("dark_side", "ダークサイト・裏社会", "社会の裏側、ダークな話題について情報交換するサロン。", "大人向け・ディープテーマ", "🌑", 30, warning_text),
        ("spy_mystery", "スパイ・ミステリー", "スパイ映画、ミステリー小説、陰謀論について語るサロン。", "大人向け・ディープテーマ", "🕵️", 31, None),
        ("gambling", "ギャンブル", "ギャンブルの話題、攻略法、体験談を語るサロン。", "大人向け・ディープテーマ", "🎰", 32, warning_text),
        ("sports", "スポーツ", "野球、サッカー、格闘技、選手応援など、スポーツについて語るサロン。", "スポーツ", "⚽", 33, None),
    ]
    for name, display_name, description, group_name, icon, sort_order, warning in salon_categories:
        db.execute(text(
            "INSERT INTO salon_categories (name, display_name, description, group_name, icon, sort_order, is_active, warning_text) "
            "VALUES (:name, :display_name, :description, :group_name, :icon, :sort_order, true, :warning) "
            "ON CONFLICT (name) DO NOTHING"
        ), {"name": name, "display_name": display_name, "description": description,
            "group_name": group_name, "icon": icon, "sort_order": sort_order, "warning": warning})

    # 7) Hobbies seed (idempotent)
    hobbies = [
        '料理','グルメ','カフェ巡り','お酒・バー','お菓子作り',
        '旅行','温泉','ドライブ','バイク','キャンプ','登山','釣り','海・ビーチ',
        'スポーツ観戦','ランニング','筋トレ','ヨガ','ダンス','サイクリング',
        '音楽鑑賞','楽器','カラオケ','DJ',
        '映画','海外ドラマ','アニメ','マンガ','コスプレ','ゲーム','ボードゲーム',
        'アート','写真','デザイン','ファッション','手芸・DIY',
        '読書','語学','プログラミング','テクノロジー',
        'ペット','ガーデニング','ボランティア','その他'
    ]
    for name in hobbies:
        db.execute(text("INSERT INTO hobbies (name) VALUES (:n) ON CONFLICT (name) DO NOTHING"), {"n": name})

    db.commit()
    return {"status": "ok"}


@router.post("/cleanup-test-data")
def cleanup_test_data(
    payload: dict,
    db: Session = Depends(get_db),
    x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret"),
):
    """テストデータをクリーンアップ（指定されたユーザーID以外を削除）"""
    # Safety guard
    if os.getenv("ALLOW_MIGRATION_API", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="migration_api_disabled")
    admin_secret = os.getenv("ADMIN_SECRET")
    if not admin_secret or x_admin_secret != admin_secret:
        raise HTTPException(status_code=401, detail="unauthorized")
    
    keep_user_ids = payload.get("keep_user_ids", [])
    
    if not keep_user_ids:
        raise HTTPException(status_code=400, detail="keep_user_ids is required")
    
    # 削除対象のユーザーIDを取得
    users_to_delete = db.query(User).filter(~User.id.in_(keep_user_ids)).all()
    user_ids_to_delete = [u.id for u in users_to_delete]
    
    # カウント用
    deleted_users = len(user_ids_to_delete)
    deleted_profiles = 0
    deleted_matching_profiles = 0
    deleted_images = 0
    deleted_posts = 0
    
    if user_ids_to_delete:
        # 関連データを削除
        # 1. マッチングプロフィール画像
        deleted_images = db.query(MatchingProfileImage).filter(
            MatchingProfileImage.profile_id.in_(user_ids_to_delete)
        ).delete(synchronize_session=False)
        
        # 2. マッチングプロフィール
        deleted_matching_profiles = db.query(MatchingProfile).filter(
            MatchingProfile.user_id.in_(user_ids_to_delete)
        ).delete(synchronize_session=False)
        
        # 3. プロフィール
        deleted_profiles = db.query(Profile).filter(
            Profile.user_id.in_(user_ids_to_delete)
        ).delete(synchronize_session=False)
        
        # 4. 投稿
        deleted_posts = db.query(Post).filter(
            Post.user_id.in_(user_ids_to_delete)
        ).delete(synchronize_session=False)
        
        # 5. メディアアセット
        db.query(MediaAsset).filter(
            MediaAsset.user_id.in_(user_ids_to_delete)
        ).delete(synchronize_session=False)
        
        # 6. ユーザー
        db.query(User).filter(
            User.id.in_(user_ids_to_delete)
        ).delete(synchronize_session=False)
        
        db.commit()
    
    # 残っているユーザーを取得
    remaining_users = db.query(User).all()
    
    return {
        "status": "ok",
        "deleted_users": deleted_users,
        "deleted_profiles": deleted_profiles,
        "deleted_matching_profiles": deleted_matching_profiles,
        "deleted_images": deleted_images,
        "deleted_posts": deleted_posts,
        "remaining_users": [
            {"id": u.id, "email": u.email, "display_name": u.display_name}
            for u in remaining_users
        ]
    }
