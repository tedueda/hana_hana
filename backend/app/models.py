import uuid
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, CheckConstraint, UniqueConstraint, BigInteger, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    display_name = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=True)
    membership_type = Column(String(20), default="premium")
    is_active = Column(Boolean, default=True)
    real_name = Column(String(100), nullable=True)
    is_verified = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255), nullable=True)
    carats = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Stripe subscription fields
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    subscription_status = Column(String(50), nullable=True)  # active, past_due, canceled, incomplete, trialing
    
    # Stripe Identity (KYC) fields
    kyc_status = Column(String(50), default="UNVERIFIED")  # UNVERIFIED, PENDING, VERIFIED, REJECTED
    stripe_identity_verification_session_id = Column(String(255), nullable=True)
    
    # Legacy paid user flag (for existing test users)
    is_legacy_paid = Column(Boolean, default=False)
    
    # Additional fields for subscription flow
    preferred_lang = Column(String(10), default="ja")
    residence_country = Column(String(10), nullable=True)  # ISO country code
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)
    terms_version = Column(String(50), nullable=True)

    # Email verification fields
    email_verified = Column(Boolean, default=False)
    email_verification_token_hash = Column(String(64), nullable=True)
    email_verification_expires = Column(DateTime(timezone=True), nullable=True)

    # Password reset fields
    password_reset_token_hash = Column(String(64), nullable=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
    
    role = Column(String(20), server_default="user", nullable=False)
    payment_status = Column(String(30), server_default="unpaid", nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # STEP③: Founder & Referral fields
    is_founder = Column(Boolean, default=False)
    ref_code = Column(String(20), unique=True, nullable=True, index=True)
    referred_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        CheckConstraint("membership_type IN ('free', 'premium', 'admin')", name="check_membership_type"),
    )
    
    profile = relationship("Profile", back_populates="user", uselist=False)
    posts = relationship("Post", back_populates="user")
    comments = relationship("Comment", back_populates="user")
    reactions = relationship("Reaction", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    point_events = relationship("PointEvent", back_populates="user")
    user_awards = relationship("UserAward", back_populates="user")
    media_assets = relationship("MediaAsset", back_populates="user")
    reviews = relationship("Review", back_populates="user")

class Orientation(Base):
    __tablename__ = "orientations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    profiles = relationship("Profile", back_populates="orientation")

class Gender(Base):
    __tablename__ = "genders"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    profiles = relationship("Profile", back_populates="gender")

class Pronoun(Base):
    __tablename__ = "pronouns"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    profiles = relationship("Profile", back_populates="pronoun")

class Profile(Base):
    __tablename__ = "profiles"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    handle = Column(String, unique=True, nullable=False)
    bio = Column(Text)
    orientation_id = Column(Integer, ForeignKey("orientations.id"), default=1)
    gender_id = Column(Integer, ForeignKey("genders.id"), default=1)
    pronoun_id = Column(Integer, ForeignKey("pronouns.id"), default=1)
    birthday = Column(Date)
    location = Column(String(100))
    website = Column(String(255))
    avatar_url = Column(String(500))
    banner_url = Column(String(500))
    is_profile_public = Column(Boolean, default=False)
    show_orientation = Column(Boolean, default=False)
    show_gender = Column(Boolean, default=False)
    show_pronoun = Column(Boolean, default=False)
    show_birthday = Column(Boolean, default=False)
    show_location = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="profile")
    orientation = relationship("Orientation", back_populates="profiles")
    gender = relationship("Gender", back_populates="profiles")
    pronoun = relationship("Pronoun", back_populates="profiles")

class MediaAsset(Base):
    __tablename__ = "media_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    url = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger)
    width = Column(Integer)
    height = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="media_assets")

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    icon = Column(String(100))  # Lucide icon name
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    subcategories = relationship("Subcategory", back_populates="category")

class Subcategory(Base):
    __tablename__ = "subcategories"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('category_id', 'slug', name='uq_category_subcategory_slug'),
    )
    
    category = relationship("Category", back_populates="subcategories")

class Post(Base):
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200))
    body = Column(Text, nullable=False)
    visibility = Column(String(20), default="public")
    youtube_url = Column(String(500))
    media_id = Column(Integer, ForeignKey("media_assets.id"))
    category = Column(String(50))
    subcategory = Column(String(100))
    
    post_type = Column(String(20), server_default='post', nullable=False)
    slug = Column(String(200), unique=True, index=True)
    status = Column(String(20), server_default='published', nullable=False)
    og_image_url = Column(String(500))
    excerpt = Column(Text)
    # Funding用フィールド
    goal_amount = Column(Integer, default=0)
    current_amount = Column(Integer, default=0)
    deadline = Column(Date, nullable=True)
    # Translation fields
    original_lang = Column(String(10), nullable=True, default="unknown")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint("visibility IN ('public', 'members', 'followers', 'private')", name="check_post_visibility"),
        CheckConstraint("post_type IN ('post', 'blog', 'tourism', 'news')", name="check_post_type"),
        CheckConstraint("status IN ('draft', 'published')", name="check_post_status"),
    )
    
    user = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post")
    tags = relationship("Tag", secondary="post_tags", back_populates="posts")
    media = relationship("MediaAsset")
    media_assets = relationship("MediaAsset", secondary="post_media", order_by="PostMedia.order_index")
    tourism_details = relationship("PostTourism", back_populates="post", uselist=False)
    translations = relationship("PostTranslation", back_populates="post", cascade="all, delete-orphan")

class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("comments.id"))
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    post = relationship("Post", back_populates="comments")
    user = relationship("User", back_populates="comments")
    parent = relationship("Comment", remote_side=[id])
    translations = relationship("CommentTranslation", back_populates="comment", cascade="all, delete-orphan")

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    posts = relationship("Post", secondary="post_tags", back_populates="tags")

class PostTag(Base):
    __tablename__ = "post_tags"
    
    post_id = Column(Integer, ForeignKey("posts.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)

class PostMedia(Base):
    __tablename__ = "post_media"
    
    post_id = Column(Integer, ForeignKey("posts.id"), primary_key=True)
    media_asset_id = Column(Integer, ForeignKey("media_assets.id"), primary_key=True)
    order_index = Column(Integer, nullable=False, server_default='0')

class PostTourism(Base):
    __tablename__ = "posts_tourism"
    
    post_id = Column(Integer, ForeignKey("posts.id"), primary_key=True)
    prefecture = Column(String(50))
    event_datetime = Column(DateTime(timezone=True))
    meet_place = Column(String(200))
    meet_address = Column(String(500))
    tour_content = Column(Text)
    fee = Column(Integer)
    contact_phone = Column(String(20))
    contact_email = Column(String(200))
    deadline = Column(DateTime(timezone=True))
    attachment_pdf_url = Column(String(500))
    
    post = relationship("Post", back_populates="tourism_details")

class Follow(Base):
    __tablename__ = "follows"
    
    follower_user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    followee_user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'accepted', 'blocked')", name="check_follow_status"),
        CheckConstraint("follower_user_id != followee_user_id", name="check_no_self_follow"),
    )

class Reaction(Base):
    __tablename__ = "reactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_type = Column(String(20), nullable=False)
    target_id = Column(Integer, nullable=False)
    reaction_type = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("target_type IN ('post', 'comment', 'review')", name="check_reaction_target_type"),
        CheckConstraint("reaction_type IN ('like', 'love', 'support', 'respect')", name="check_reaction_type"),
        UniqueConstraint("user_id", "target_type", "target_id", "reaction_type", name="unique_user_reaction"),
    )
    
    user = relationship("User", back_populates="reactions")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)
    payload = Column(JSON)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="notifications")

class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    reporter_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_type = Column(String(20), nullable=False)
    target_id = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="open")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint("target_type IN ('post', 'comment', 'review', 'user')", name="check_report_target_type"),
        CheckConstraint("status IN ('open', 'under_review', 'resolved', 'dismissed')", name="check_report_status"),
    )

class Block(Base):
    __tablename__ = "blocks"
    
    blocker_user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    blocked_user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("blocker_user_id != blocked_user_id", name="check_no_self_block"),
    )

class ContentItem(Base):
    __tablename__ = "content_items"
    
    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String(20), nullable=False)
    title = Column(String(200), nullable=False)
    creator = Column(String(200))
    release_year = Column(Integer)
    isbn = Column(String(20))
    url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("item_type IN ('book', 'movie', 'drama', 'comic')", name="check_content_item_type"),
    )
    
    reviews = relationship("Review", back_populates="item")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("content_items.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    title = Column(String(200))
    body = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="check_rating_range"),
        UniqueConstraint("item_id", "user_id", name="unique_user_item_review"),
    )
    
    item = relationship("ContentItem", back_populates="reviews")
    user = relationship("User", back_populates="reviews")

class PointEvent(Base):
    __tablename__ = "point_events"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    points = Column(Integer, nullable=False)
    ref_type = Column(String(20))
    ref_id = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="point_events")

class Award(Base):
    __tablename__ = "awards"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    threshold_points = Column(Integer, nullable=False)
    prize_amount_yen = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user_awards = relationship("UserAward", back_populates="award")

class UserAward(Base):
    __tablename__ = "user_awards"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    award_id = Column(Integer, ForeignKey("awards.id"), nullable=False)
    awarded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint("user_id", "award_id", name="unique_user_award"),
    )
    
    user = relationship("User", back_populates="user_awards")
    award = relationship("Award", back_populates="user_awards")

# ===== Matching domain models =====

class MatchingProfile(Base):
    __tablename__ = "matching_profiles"
    __table_args__ = {'extend_existing': True}

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    nickname = Column(String(100))
    display_flag = Column(Boolean, nullable=False, default=True)
    nationality = Column(String(100), nullable=True)  # 国籍（ISO 3166-1 alpha-2 code, e.g., "JP", "US"）
    prefecture = Column(String(100), nullable=False, default="")
    residence_detail = Column(String(100))
    hometown = Column(String(100))
    age_band = Column(String(50))
    occupation = Column(String(100))
    income_range = Column(String(100))
    blood_type = Column(String(20))
    zodiac = Column(String(20))
    meet_pref = Column(String(50))
    meeting_style = Column(String(50))
    bio = Column(Text)
    identity = Column(String(50))
    romance_targets = Column(JSON, default=list)
    avatar_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User")


class Hobby(Base):
    __tablename__ = "hobbies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MatchingProfileHobby(Base):
    __tablename__ = "matching_profile_hobbies"

    profile_id = Column(Integer, ForeignKey("matching_profiles.user_id"), primary_key=True)
    hobby_id = Column(Integer, ForeignKey("hobbies.id"), primary_key=True)


class MatchingProfileImage(Base):
    __tablename__ = "matching_profile_images"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("matching_profiles.user_id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("profile_id", "display_order", name="unique_profile_order"),
        CheckConstraint("display_order >= 0 AND display_order < 5", name="check_order_range"),
    )


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("from_user_id", "to_user_id", name="uniq_like_from_to"),
        CheckConstraint("status IN ('active','withdrawn')", name="check_like_status"),
    )


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    user_a_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_b_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    active_flag = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uniq_match_pair"),
        CheckConstraint("user_a_id != user_b_id", name="check_match_distinct_users"),
    )


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True))
    
    translations = relationship("MessageTranslation", back_populates="message", cascade="all, delete-orphan")


class ChatRequest(Base):
    __tablename__ = "chat_requests"

    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    initial_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("from_user_id", "to_user_id", "status", name="uniq_chat_request_pending"),
        CheckConstraint("status IN ('pending','accepted','declined')", name="check_chat_request_status"),
        CheckConstraint("from_user_id != to_user_id", name="check_chat_request_distinct_users"),
    )


class ChatRequestMessage(Base):
    __tablename__ = "chat_request_messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_request_id = Column(Integer, ForeignKey("chat_requests.id"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    migrated_at = Column(DateTime(timezone=True))

class DonationProject(Base):
    __tablename__ = "donation_projects"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)
    goal_amount = Column(Integer, nullable=False)
    current_amount = Column(Integer, default=0, nullable=False)
    deadline = Column(Date, nullable=False)
    supporters_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class DonationProjectImage(Base):
    __tablename__ = "donation_project_images"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("donation_projects.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DonationSupport(Base):
    __tablename__ = "donation_supports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("donation_projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    message = Column(Text, nullable=True)
    is_anonymous = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SalonRoom(Base):
    __tablename__ = "salon_rooms"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    theme = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    target_identities = Column(JSON, nullable=False)
    room_type = Column(String(50), nullable=False)
    allow_anonymous = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("room_type IN ('consultation', 'exchange', 'story', 'other')", name="check_salon_room_type"),
    )

    creator = relationship("User")
    participants = relationship("SalonParticipant", back_populates="room")
    messages = relationship("SalonMessage", back_populates="room")


class SalonParticipant(Base):
    __tablename__ = "salon_participants"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("salon_rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    anonymous_name = Column(String(100), nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="unique_salon_participant"),
    )

    room = relationship("SalonRoom", back_populates="participants")
    user = relationship("User")


class SalonMessage(Base):
    __tablename__ = "salon_messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("salon_rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_anonymous = Column(Boolean, default=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    room = relationship("SalonRoom", back_populates="messages")
    user = relationship("User")
    translations = relationship("SalonMessageTranslation", back_populates="salon_message", cascade="all, delete-orphan")


# ===== Flea Market (フリマ) domain models =====

class FleaMarketItem(Base):
    __tablename__ = "flea_market_items"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Integer, nullable=False)  # 希望価格（円）
    is_negotiable = Column(Boolean, default=False)  # 価格交渉可能か
    category = Column(String(100), nullable=False)
    region = Column(String(100))  # 地域
    transaction_method = Column(String(50), nullable=False, default="negotiable")  # hand_delivery, shipping, negotiable
    status = Column(String(20), nullable=False, default="active")  # active, reserved, sold, cancelled
    view_count = Column(Integer, default=0)  # 閲覧数
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("transaction_method IN ('hand_delivery', 'shipping', 'negotiable')", name="check_transaction_method"),
        CheckConstraint("status IN ('active', 'reserved', 'sold', 'cancelled')", name="check_flea_market_status"),
    )

    seller = relationship("User")
    images = relationship("FleaMarketItemImage", back_populates="item", order_by="FleaMarketItemImage.display_order")


class FleaMarketItemImage(Base):
    __tablename__ = "flea_market_item_images"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("flea_market_items.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("FleaMarketItem", back_populates="images")


class FleaMarketChat(Base):
    __tablename__ = "flea_market_chats"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("flea_market_items.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="active")  # active, closed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('active', 'closed')", name="check_flea_market_chat_status"),
        UniqueConstraint("item_id", "buyer_id", name="unique_item_buyer_chat"),
    )

    item = relationship("FleaMarketItem")
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    messages = relationship("FleaMarketMessage", back_populates="chat", order_by="FleaMarketMessage.created_at")


class FleaMarketMessage(Base):
    __tablename__ = "flea_market_messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("flea_market_chats.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chat = relationship("FleaMarketChat", back_populates="messages")
    sender = relationship("User")


# ===== Art Sales (作品販売) domain models =====

class ArtSaleItem(Base):
    __tablename__ = "art_sale_items"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Integer, nullable=False)  # 価格（円）
    category = Column(String(100), nullable=False)
    technique = Column(String(100))  # 技法
    size = Column(String(100))  # サイズ
    year_created = Column(Integer)  # 制作年
    is_original = Column(Boolean, nullable=False, default=True)  # オリジナル作品かどうか
    transaction_method = Column(String(50), nullable=False, default="negotiable")  # hand_delivery, shipping, negotiable
    status = Column(String(20), nullable=False, default="active")  # active, sold, cancelled
    view_count = Column(Integer, nullable=False, default=0)  # 閲覧数
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    seller = relationship("User")
    images = relationship("ArtSaleItemImage", back_populates="item", order_by="ArtSaleItemImage.display_order")


class ArtSaleItemImage(Base):
    __tablename__ = "art_sale_item_images"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("art_sale_items.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("ArtSaleItem", back_populates="images")


# ===== Jewelry Shopping (ジュエリーEC) domain models =====

class JewelryProduct(Base):
    __tablename__ = "jewelry_products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    material = Column(String(200))  # 素材
    size = Column(String(100))  # サイズ
    additional_info = Column(Text)  # その他補足情報
    price = Column(Integer, nullable=False)  # 価格（円）
    price_includes_tax = Column(Boolean, default=True)  # 税込みかどうか
    stock = Column(Integer, default=0)  # 在庫数（0=無制限または管理しない）
    category = Column(String(50), default="jewelry")  # 固定値: jewelry
    is_active = Column(Boolean, default=True)  # 販売中かどうか
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    images = relationship("JewelryProductImage", back_populates="product", order_by="JewelryProductImage.display_order")
    cart_items = relationship("CartItem", back_populates="product")
    order_items = relationship("OrderItem", back_populates="product")


class JewelryProductImage(Base):
    __tablename__ = "jewelry_product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("jewelry_products.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(String(500), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("JewelryProduct", back_populates="images")


class Cart(Base):
    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User")
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    cart_id = Column(Integer, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("jewelry_products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("cart_id", "product_id", name="unique_cart_product"),
    )

    cart = relationship("Cart", back_populates="items")
    product = relationship("JewelryProduct", back_populates="cart_items")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, paid, shipped, delivered, cancelled
    total_amount = Column(Integer, nullable=False)  # 合計金額（円）
    
    # 配送先情報
    recipient_name = Column(String(100), nullable=False)
    postal_code = Column(String(10))
    address = Column(Text, nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    
    # Stripe関連
    stripe_payment_intent_id = Column(String(255))
    stripe_charge_id = Column(String(255))
    
    paid_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')", name="check_order_status"),
    )

    user = relationship("User")
    items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("jewelry_products.id"), nullable=False)
    product_name = Column(String(200), nullable=False)  # 注文時の商品名を保存
    price = Column(Integer, nullable=False)  # 注文時の価格を保存
    quantity = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="items")
    product = relationship("JewelryProduct", back_populates="order_items")


# ===== Course (講座) domain models =====

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(80), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)
    price_label = Column(String(100), nullable=False)  # 自由記述: "¥5,000", "無料", "月額¥2,000"
    external_url = Column(Text, nullable=False)
    instructor_profile = Column(Text, nullable=True)  # 講師プロフィール（最大1000文字）
    published = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "category IN ('business', 'creative', 'language', 'health', 'relationship', 'life', 'other')",
            name="check_course_category"
        ),
    )

    owner = relationship("User")
    images = relationship("CourseImage", back_populates="course", order_by="CourseImage.sort_order", cascade="all, delete-orphan")
    videos = relationship("CourseVideo", back_populates="course", order_by="CourseVideo.sort_order", cascade="all, delete-orphan")


class CourseImage(Base):
    __tablename__ = "course_images"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)  # 0..4
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course", back_populates="images")


class CourseVideo(Base):
    __tablename__ = "course_videos"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    youtube_url = Column(Text, nullable=False)
    youtube_video_id = Column(String(20), nullable=False)  # 抽出して保存
    sort_order = Column(Integer, nullable=False, default=0)  # 0..5
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course", back_populates="videos")


# ===== Post Translation Models =====

class PostTranslation(Base):
    __tablename__ = "post_translations"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    lang = Column(String(10), nullable=False, index=True)
    translated_title = Column(String(200), nullable=True)
    translated_text = Column(Text, nullable=False)
    provider = Column(String(50), nullable=False, default="openai")
    error_code = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("post_id", "lang", name="uq_post_translation_lang"),
    )

    post = relationship("Post", back_populates="translations")


class CommentTranslation(Base):
    __tablename__ = "comment_translations"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    lang = Column(String(10), nullable=False, index=True)
    translated_text = Column(Text, nullable=False)
    provider = Column(String(50), nullable=False, default="openai")
    error_code = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("comment_id", "lang", name="uq_comment_translation_lang"),
    )

    comment = relationship("Comment", back_populates="translations")


class MessageTranslation(Base):
    __tablename__ = "message_translations"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    lang = Column(String(10), nullable=False, index=True)
    translated_text = Column(Text, nullable=False)
    provider = Column(String(50), nullable=False, default="openai")
    error_code = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("message_id", "lang", name="uq_message_translation_lang"),
    )

    message = relationship("Message", back_populates="translations")


class SalonMessageTranslation(Base):
    __tablename__ = "salon_message_translations"

    id = Column(Integer, primary_key=True, index=True)
    salon_message_id = Column(Integer, ForeignKey("salon_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    lang = Column(String(10), nullable=False, index=True)
    translated_text = Column(Text, nullable=False)
    provider = Column(String(50), nullable=False, default="openai")
    error_code = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("salon_message_id", "lang", name="uq_salon_message_translation_lang"),
    )

    salon_message = relationship("SalonMessage", back_populates="translations")


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    slug = Column(String(300), unique=True, nullable=False, index=True)
    body = Column(Text, nullable=False)
    excerpt = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    seo_keywords = Column(JSON, nullable=True)
    status = Column(String(20), server_default="draft", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published')", name="check_blog_status"),
    )

    creator = relationship("User")


class BlogPostTranslation(Base):
    __tablename__ = "blog_post_translations"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blog_post_id = Column(PG_UUID(as_uuid=True), ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False)
    language = Column(String(10), nullable=False)
    title = Column(String(600), nullable=False)
    body = Column(Text, nullable=False)
    excerpt = Column(Text, nullable=True)
    seo_keywords = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("blog_post_id", "language", name="uq_blog_translation_post_lang"),
    )

    blog_post = relationship("BlogPost")


# ===== STEP③: Referral tracking =====

class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ref_code = Column(String(20), nullable=False, index=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=True)
    target_id = Column(String(100), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    ip = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    admin = relationship("User")
