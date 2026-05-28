"""Add salon categories, room tags, posts, comments, reports tables

Revision ID: 20260526_salon_cats
Revises: 20260202_salon_msg_trans
Create Date: 2026-05-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = '20260526_salon_cats'
down_revision = '20260202_salon_msg_trans'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. salon_categories
    if "salon_categories" not in existing_tables:
        op.create_table(
            "salon_categories",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("name", sa.String(100), nullable=False, unique=True),
            sa.Column("display_name", sa.String(100), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("group_name", sa.String(100), nullable=False),
            sa.Column("icon", sa.String(50), nullable=True),
            sa.Column("sort_order", sa.Integer, default=0),
            sa.Column("is_active", sa.Boolean, server_default="true"),
            sa.Column("warning_text", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )

    # 2. Add new columns to salon_rooms if they don't exist
    if "salon_rooms" in existing_tables:
        existing_columns = [c["name"] for c in inspector.get_columns("salon_rooms")]
        if "category_id" not in existing_columns:
            op.add_column("salon_rooms", sa.Column("category_id", sa.Integer, sa.ForeignKey("salon_categories.id"), nullable=True))
        if "target_audiences" not in existing_columns:
            op.add_column("salon_rooms", sa.Column("target_audiences", sa.JSON, nullable=True))
        if "visibility" not in existing_columns:
            op.add_column("salon_rooms", sa.Column("visibility", sa.String(20), server_default="public"))
        if "thumbnail_url" not in existing_columns:
            op.add_column("salon_rooms", sa.Column("thumbnail_url", sa.String(500), nullable=True))
        if "status" not in existing_columns:
            op.add_column("salon_rooms", sa.Column("status", sa.String(20), server_default="active"))

    # 3. salon_room_tags
    if "salon_room_tags" not in existing_tables:
        op.create_table(
            "salon_room_tags",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("room_id", sa.Integer, sa.ForeignKey("salon_rooms.id", ondelete="CASCADE"), nullable=False),
            sa.Column("tag_name", sa.String(100), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )

    # 4. salon_posts
    if "salon_posts" not in existing_tables:
        op.create_table(
            "salon_posts",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("room_id", sa.Integer, sa.ForeignKey("salon_rooms.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("content", sa.Text, nullable=False),
            sa.Column("status", sa.String(20), server_default="active"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )

    # 5. salon_comments
    if "salon_comments" not in existing_tables:
        op.create_table(
            "salon_comments",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("post_id", sa.Integer, sa.ForeignKey("salon_posts.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("content", sa.Text, nullable=False),
            sa.Column("status", sa.String(20), server_default="active"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )

    # 6. salon_reports
    if "salon_reports" not in existing_tables:
        op.create_table(
            "salon_reports",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("room_id", sa.Integer, sa.ForeignKey("salon_rooms.id", ondelete="SET NULL"), nullable=True),
            sa.Column("post_id", sa.Integer, sa.ForeignKey("salon_posts.id", ondelete="SET NULL"), nullable=True),
            sa.Column("comment_id", sa.Integer, sa.ForeignKey("salon_comments.id", ondelete="SET NULL"), nullable=True),
            sa.Column("reported_by_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("reason", sa.Text, nullable=False),
            sa.Column("status", sa.String(20), server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        )

    # 7. Seed salon categories
    _seed_categories(op)


def _seed_categories(op):
    """Insert salon categories (33 original + 16 additional) grouped into 5 groups."""
    warning_text = "このカテゴリーでは、違法行為の助長、勧誘、売買、露骨な性的表現は禁止されています。安心して相談・情報交換ができる場としてご利用ください。"

    categories = [
        # エンタメ・カルチャー
        ("music", "音楽", "好きなアーティスト、ライブ、楽曲について語るサロン。", "エンタメ・カルチャー", "🎵", 1, None),
        ("movie", "映画", "映画の感想、おすすめ作品、LGBTQ＋映画、名シーンなどを語るサロン。", "エンタメ・カルチャー", "🎬", 2, None),
        ("drama", "ドラマ", "国内外のドラマの感想、おすすめ作品を語るサロン。", "エンタメ・カルチャー", "📺", 3, None),
        ("anime", "アニメ", "アニメの感想、おすすめ作品、キャラクター考察を語るサロン。", "エンタメ・カルチャー", "🎌", 4, None),
        ("theater", "演劇", "舞台、ミュージカル、演劇の感想や情報を共有するサロン。", "エンタメ・カルチャー", "🎭", 5, None),
        ("kabuki", "歌舞伎", "歌舞伎の演目、役者、鑑賞記録を語るサロン。", "エンタメ・カルチャー", "🏯", 6, None),
        ("nihon_buyo", "日本舞踊", "日本舞踊の魅力、稽古、公演情報を共有するサロン。", "エンタメ・カルチャー", "💃", 7, None),
        ("theme_park", "テーマパーク", "テーマパークの攻略情報、おすすめアトラクションを語るサロン。", "エンタメ・カルチャー", "🎢", 8, None),
        ("game", "ゲーム", "ゲームの攻略、おすすめタイトル、一緒にプレイする仲間を見つけるサロン。", "エンタメ・カルチャー", "🎮", 9, None),
        # ライフスタイル
        ("travel", "旅行", "おすすめの旅行先、LGBTQ＋フレンドリーなスポット情報を共有するサロン。", "ライフスタイル", "✈️", 10, None),
        ("gourmet", "グルメ", "おいしいお店、レシピ、食のトレンドを語るサロン。", "ライフスタイル", "🍽️", 11, None),
        ("beauty", "美容", "メイク、スキンケア、脱毛、髪型、自分らしい見た目について語るサロン。", "ライフスタイル", "💄", 12, None),
        ("fashion", "ファッション", "ジェンダーレスファッション、コーデ、ブランド情報を語るサロン。", "ライフスタイル", "👗", 13, None),
        ("pet", "ペット", "ペットの写真、飼育相談、ペット同伴スポットを共有するサロン。", "ライフスタイル", "🐾", 14, None),
        ("animal", "動物", "動物の生態、動物園情報、野生動物の話題を語るサロン。", "ライフスタイル", "🦁", 15, None),
        ("nature", "自然", "自然の美しさ、アウトドア、キャンプ、登山について語るサロン。", "ライフスタイル", "🌿", 16, None),
        ("love_relationship", "愛・人間関係", "恋愛、友情、家族関係、人間関係の悩みを相談・共有するサロン。", "ライフスタイル", "💕", 17, None),
        # 社会・知識
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
        # 大人向け・ディープテーマ
        ("sex_romance", "SEX・恋愛", "セクシュアリティ、恋愛の悩み、パートナーシップについて語るサロン。", "大人向け・ディープテーマ", "🔥", 28, warning_text),
        ("drug_addiction", "ドラッグ・依存・社会問題", "依存症、社会問題、回復について安心して語れるサロン。", "大人向け・ディープテーマ", "⚠️", 29, warning_text),
        ("dark_side", "ダークサイト・裏社会", "社会の裏側、ダークな話題について情報交換するサロン。", "大人向け・ディープテーマ", "🌑", 30, warning_text),
        ("spy_mystery", "スパイ・ミステリー", "スパイ映画、ミステリー小説、陰謀論について語るサロン。", "大人向け・ディープテーマ", "🕵️", 31, None),
        ("gambling", "ギャンブル", "ギャンブルの話題、攻略法、体験談を語るサロン。", "大人向け・ディープテーマ", "🎰", 32, warning_text),
        # スポーツ
        ("sports", "スポーツ", "野球、サッカー、格闘技、選手応援など、スポーツについて語るサロン。", "スポーツ", "⚽", 33, None),
        # 追加カテゴリー
        ("sauna_sento", "サウナ・銭湯", "サウナ、銭湯、温泉、整いスポット、入浴マナーについて語るサロン。", "ライフスタイル", "🛁", 34, None),
        ("lgbtq_news", "LGBTQ＋ニュース・社会", "LGBTQ＋に関するニュース、制度、社会の動きについて語るサロン。", "社会・知識", "🏳️‍🌈", 35, None),
        ("mental_care", "心理・メンタルケア", "自己理解、孤独、不安、ストレス、心の整え方について語るサロン。", "社会・知識", "🧠", 36, None),
        ("adult_nightlife", "アダルト・ナイトライフ", "大人向けの出会い、ナイトスポット、セクシャルな話題について語るサロン。", "大人向け・ディープテーマ", "🔞", 37, "このカテゴリーは18歳以上の方を対象としています。違法行為・公共の迷惑行為、盗撮・晒し・個人特定、同意のない性的投稿は禁止です。具体的すぎる性行為描写は制限されています。店舗・場所の投稿は安全面とマナーを重視してください。"),
        ("baseball", "野球", "プロ野球、高校野球、メジャーリーグ、選手応援について語るサロン。", "スポーツ", "⚾", 38, None),
        ("soccer", "サッカー", "Jリーグ、海外サッカー、日本代表、推し選手について語るサロン。", "スポーツ", "⚽", 39, None),
        ("rugby", "ラグビー", "国内リーグ、日本代表、ワールドカップ、ラグビー観戦について語るサロン。", "スポーツ", "🏉", 40, None),
        ("basketball", "バスケットボール", "Bリーグ、NBA、日本代表、推しチームについて語るサロン。", "スポーツ", "🏀", 41, None),
        ("tennis", "テニス", "国内外の大会、選手、観戦、プレーについて語るサロン。", "スポーツ", "🎾", 42, None),
        ("volleyball", "バレーボール", "Vリーグ、日本代表、男子・女子バレーについて語るサロン。", "スポーツ", "🏐", 43, None),
        ("swimming", "水泳", "競泳、フィットネス水泳、プール、健康づくりについて語るサロン。", "スポーツ", "🏊", 44, None),
        ("running_marathon", "ランニング・マラソン", "ジョギング、マラソン大会、健康管理、走る習慣について語るサロン。", "スポーツ", "🏃", 45, None),
        ("gym_fitness", "筋トレ・フィットネス", "ジム、筋トレ、ボディメイク、ダイエットについて語るサロン。", "スポーツ", "🏋️", 46, None),
        ("martial_arts", "格闘技", "ボクシング、MMA、プロレス、格闘技観戦について語るサロン。", "スポーツ", "🥊", 47, None),
        ("golf", "ゴルフ", "ゴルフ場、練習、道具、ゴルフ仲間づくりについて語るサロン。", "スポーツ", "⛳", 48, None),
        ("yoga_pilates", "ヨガ・ピラティス", "ヨガ、ピラティス、ストレッチ、心身のケアについて語るサロン。", "スポーツ", "🧘", 49, None),
    ]

    for name, display_name, description, group_name, icon, sort_order, warning in categories:
        op.execute(
            sa.text(
                "INSERT INTO salon_categories (name, display_name, description, group_name, icon, sort_order, is_active, warning_text) "
                "VALUES (:name, :display_name, :description, :group_name, :icon, :sort_order, true, :warning) "
                "ON CONFLICT (name) DO NOTHING"
            ).bindparams(
                name=name, display_name=display_name, description=description,
                group_name=group_name, icon=icon, sort_order=sort_order, warning=warning
            )
        )


def downgrade() -> None:
    op.drop_table("salon_reports")
    op.drop_table("salon_comments")
    op.drop_table("salon_posts")
    op.drop_table("salon_room_tags")
    op.drop_column("salon_rooms", "status")
    op.drop_column("salon_rooms", "thumbnail_url")
    op.drop_column("salon_rooms", "visibility")
    op.drop_column("salon_rooms", "target_audiences")
    op.drop_column("salon_rooms", "category_id")
    op.drop_table("salon_categories")
