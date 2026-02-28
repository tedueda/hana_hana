from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

class VisibilityEnum(str, Enum):
    public = "public"
    members = "members"
    followers = "followers"
    private = "private"

class ReactionTypeEnum(str, Enum):
    like = "like"
    love = "love"
    support = "support"
    respect = "respect"

class UserBase(BaseModel):
    email: EmailStr
    display_name: str

class UserCreate(UserBase):
    password: str
    phone_number: Optional[str] = None
    residence_country: Optional[str] = None

class UserUpdate(BaseModel):
    display_name: Optional[str] = None

class User(UserBase):
    id: int
    membership_type: str
    is_active: bool
    created_at: datetime
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True

class ProfileBase(BaseModel):
    handle: str
    bio: Optional[str] = None
    orientation_id: Optional[int] = 1
    gender_id: Optional[int] = 1
    pronoun_id: Optional[int] = 1
    birthday: Optional[date] = None
    location: Optional[str] = None
    website: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_profile_public: bool = False
    show_orientation: bool = False
    show_gender: bool = False
    show_pronoun: bool = False
    show_birthday: bool = False
    show_location: bool = False

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(BaseModel):
    handle: Optional[str] = None
    bio: Optional[str] = None
    orientation_id: Optional[int] = None
    gender_id: Optional[int] = None
    pronoun_id: Optional[int] = None
    birthday: Optional[date] = None
    location: Optional[str] = None
    website: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_profile_public: Optional[bool] = None
    show_orientation: Optional[bool] = None
    show_gender: Optional[bool] = None
    show_pronoun: Optional[bool] = None
    show_birthday: Optional[bool] = None
    show_location: Optional[bool] = None

class Profile(ProfileBase):
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class PostTypeEnum(str, Enum):
    post = "post"
    blog = "blog"
    tourism = "tourism"

class PostStatusEnum(str, Enum):
    draft = "draft"
    published = "published"

class PostBase(BaseModel):
    title: Optional[str] = None
    body: str
    visibility: VisibilityEnum = VisibilityEnum.public
    youtube_url: Optional[str] = None
    media_id: Optional[int] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    post_type: PostTypeEnum = PostTypeEnum.post
    slug: Optional[str] = None
    status: PostStatusEnum = PostStatusEnum.published
    og_image_url: Optional[str] = None
    excerpt: Optional[str] = None
    # Funding用フィールド
    goal_amount: Optional[int] = 0
    current_amount: Optional[int] = 0
    deadline: Optional[date] = None

class PostTourismDetails(BaseModel):
    prefecture: Optional[str] = None
    event_datetime: Optional[datetime] = None
    meet_place: Optional[str] = None
    meet_address: Optional[str] = None
    tour_content: Optional[str] = None
    fee: Optional[int] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    deadline: Optional[datetime] = None
    attachment_pdf_url: Optional[str] = None

class PostCreate(PostBase):
    media_ids: Optional[List[int]] = None
    tourism_details: Optional[PostTourismDetails] = None

class PostUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    visibility: Optional[VisibilityEnum] = None
    youtube_url: Optional[str] = None
    media_id: Optional[int] = None
    media_ids: Optional[List[int]] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    post_type: Optional[PostTypeEnum] = None
    slug: Optional[str] = None
    status: Optional[PostStatusEnum] = None
    og_image_url: Optional[str] = None
    excerpt: Optional[str] = None
    tourism_details: Optional[PostTourismDetails] = None
    # Funding用フィールド
    goal_amount: Optional[int] = None
    current_amount: Optional[int] = None
    deadline: Optional[date] = None

class Post(PostBase):
    id: int
    user_id: int
    media_url: Optional[str] = None
    media_urls: Optional[List[str]] = None
    tourism_details: Optional[PostTourismDetails] = None
    created_at: datetime
    updated_at: datetime
    like_count: Optional[int] = 0
    comment_count: Optional[int] = 0
    user_display_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class CommentBase(BaseModel):
    body: str
    parent_id: Optional[int] = None

class CommentCreate(CommentBase):
    post_id: int

class CommentUpdate(BaseModel):
    body: Optional[str] = None

class Comment(CommentBase):
    id: int
    post_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ReactionCreate(BaseModel):
    target_type: str
    target_id: int
    reaction_type: ReactionTypeEnum

class Reaction(BaseModel):
    id: int
    user_id: int
    target_type: str
    target_id: int
    reaction_type: ReactionTypeEnum
    created_at: datetime
    
    class Config:
        from_attributes = True

class FollowCreate(BaseModel):
    followee_user_id: int

class Follow(BaseModel):
    follower_user_id: int
    followee_user_id: int
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class NotificationUpdate(BaseModel):
    is_read: bool

class Notification(BaseModel):
    id: int
    user_id: int
    type: str
    payload: Optional[dict] = None
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class PhoneVerificationRequest(BaseModel):
    phone_number: str

class PhoneVerificationConfirm(BaseModel):
    phone_number: str
    verification_code: str

class UserRegistrationStep1(BaseModel):
    phone_number: str
    email: EmailStr
    password: str
    display_name: str

class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class SalonRoomTypeEnum(str, Enum):
    consultation = "consultation"
    exchange = "exchange"
    story = "story"
    other = "other"


class SalonRoomBase(BaseModel):
    theme: str
    description: str
    target_identities: List[str]
    room_type: SalonRoomTypeEnum
    allow_anonymous: bool = False


class SalonRoomCreate(SalonRoomBase):
    pass


class SalonRoomUpdate(BaseModel):
    theme: Optional[str] = None
    description: Optional[str] = None
    target_identities: Optional[List[str]] = None
    room_type: Optional[SalonRoomTypeEnum] = None
    allow_anonymous: Optional[bool] = None
    is_active: Optional[bool] = None


class SalonRoom(SalonRoomBase):
    id: int
    creator_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    participant_count: Optional[int] = 0
    creator_display_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class SalonParticipantBase(BaseModel):
    anonymous_name: Optional[str] = None


class SalonParticipantCreate(SalonParticipantBase):
    room_id: int


class SalonParticipant(SalonParticipantBase):
    id: int
    room_id: int
    user_id: int
    joined_at: datetime
    user_display_name: Optional[str] = None
    user_avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class SalonMessageBase(BaseModel):
    body: str
    is_anonymous: bool = False


class SalonMessageCreate(SalonMessageBase):
    room_id: int


class SalonMessage(SalonMessageBase):
    id: int
    room_id: int
    user_id: int
    created_at: datetime
    user_display_name: Optional[str] = None
    user_avatar_url: Optional[str] = None
    anonymous_name: Optional[str] = None
    
    class Config:
        from_attributes = True


# ===== Flea Market (フリマ) Schemas =====

class TransactionMethodEnum(str, Enum):
    hand_off = "hand_off"
    shipping = "shipping"
    negotiable = "negotiable"


class FleaMarketStatusEnum(str, Enum):
    active = "active"
    sold = "sold"
    cancelled = "cancelled"


class FleaMarketItemBase(BaseModel):
    title: str
    description: str
    price: int
    category: str
    region: Optional[str] = None
    transaction_method: TransactionMethodEnum = TransactionMethodEnum.negotiable


class FleaMarketItemCreate(FleaMarketItemBase):
    image_urls: Optional[List[str]] = None


class FleaMarketItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    category: Optional[str] = None
    region: Optional[str] = None
    transaction_method: Optional[TransactionMethodEnum] = None
    status: Optional[FleaMarketStatusEnum] = None
    image_urls: Optional[List[str]] = None


class FleaMarketItemImage(BaseModel):
    id: int
    image_url: str
    display_order: int
    
    class Config:
        from_attributes = True


class FleaMarketItem(FleaMarketItemBase):
    id: int
    user_id: int
    status: FleaMarketStatusEnum
    created_at: datetime
    updated_at: datetime
    images: List[FleaMarketItemImage] = []
    user_display_name: Optional[str] = None
    user_avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class FleaMarketChatBase(BaseModel):
    item_id: int


class FleaMarketChatCreate(FleaMarketChatBase):
    initial_message: Optional[str] = None


class FleaMarketChat(FleaMarketChatBase):
    id: int
    buyer_id: int
    seller_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    item_title: Optional[str] = None
    buyer_display_name: Optional[str] = None
    seller_display_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class FleaMarketMessageBase(BaseModel):
    body: str


class FleaMarketMessageCreate(FleaMarketMessageBase):
    chat_id: int


class FleaMarketMessage(FleaMarketMessageBase):
    id: int
    chat_id: int
    sender_id: int
    created_at: datetime
    sender_display_name: Optional[str] = None
    
    class Config:
        from_attributes = True


# ===== Jewelry Shopping (ジュエリーEC) Schemas =====

class OrderStatusEnum(str, Enum):
    pending = "pending"
    paid = "paid"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


# Product schemas
class JewelryProductImageBase(BaseModel):
    image_url: str
    display_order: int = 0


class JewelryProductImage(JewelryProductImageBase):
    id: int
    product_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class JewelryProductBase(BaseModel):
    name: str
    description: str
    material: Optional[str] = None
    size: Optional[str] = None
    additional_info: Optional[str] = None
    price: int
    price_includes_tax: bool = True
    stock: Optional[int] = 0


class JewelryProductCreate(JewelryProductBase):
    image_urls: Optional[List[str]] = None


class JewelryProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    material: Optional[str] = None
    size: Optional[str] = None
    additional_info: Optional[str] = None
    price: Optional[int] = None
    price_includes_tax: Optional[bool] = None
    stock: Optional[int] = None
    is_active: Optional[bool] = None
    image_urls: Optional[List[str]] = None


class JewelryProduct(JewelryProductBase):
    id: int
    category: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    images: List[JewelryProductImage] = []
    
    class Config:
        from_attributes = True


# Cart schemas
class CartItemBase(BaseModel):
    product_id: int
    quantity: int = 1


class CartItemCreate(CartItemBase):
    pass


class CartItemUpdate(BaseModel):
    quantity: int


class CartItem(CartItemBase):
    id: int
    cart_id: int
    created_at: datetime
    updated_at: datetime
    product: Optional[JewelryProduct] = None
    
    class Config:
        from_attributes = True


class Cart(BaseModel):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    items: List[CartItem] = []
    total_amount: int = 0
    
    class Config:
        from_attributes = True


# Order schemas
class OrderItemBase(BaseModel):
    product_id: int
    quantity: int = 1


class OrderItem(OrderItemBase):
    id: int
    order_id: int
    product_name: str
    price: int
    created_at: datetime
    product: Optional[JewelryProduct] = None
    
    class Config:
        from_attributes = True


class ShippingInfo(BaseModel):
    recipient_name: str
    postal_code: Optional[str] = None
    address: str
    phone: Optional[str] = None
    email: Optional[str] = None


class OrderCreate(BaseModel):
    shipping_info: ShippingInfo


class Order(BaseModel):
    id: int
    user_id: int
    status: OrderStatusEnum
    total_amount: int
    recipient_name: str
    postal_code: Optional[str] = None
    address: str
    phone: Optional[str] = None
    email: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: List[OrderItem] = []
    
    class Config:
        from_attributes = True


# Stripe payment schemas
class CreatePaymentIntentRequest(BaseModel):
    order_id: int


class CreatePaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int


class ConfirmPaymentRequest(BaseModel):
    order_id: int
    payment_intent_id: str


# ===== Art Sales (作品販売) Schemas =====

class ArtSaleStatusEnum(str, Enum):
    active = "active"
    sold = "sold"
    cancelled = "cancelled"


class ArtSaleItemImageBase(BaseModel):
    image_url: str
    display_order: int = 0


class ArtSaleItemImage(ArtSaleItemImageBase):
    id: int
    
    class Config:
        from_attributes = True


class ArtSaleItemBase(BaseModel):
    title: str
    description: str
    price: int
    category: str
    technique: Optional[str] = None
    size: Optional[str] = None
    year_created: Optional[int] = None
    is_original: bool = True
    transaction_method: TransactionMethodEnum = TransactionMethodEnum.negotiable


class ArtSaleItemCreate(ArtSaleItemBase):
    image_urls: Optional[List[str]] = None


class ArtSaleItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    category: Optional[str] = None
    technique: Optional[str] = None
    size: Optional[str] = None
    year_created: Optional[int] = None
    is_original: Optional[bool] = None
    transaction_method: Optional[TransactionMethodEnum] = None
    status: Optional[ArtSaleStatusEnum] = None
    image_urls: Optional[List[str]] = None


class ArtSaleItem(ArtSaleItemBase):
    id: int
    user_id: int
    status: ArtSaleStatusEnum
    view_count: int = 0
    created_at: datetime
    updated_at: datetime
    images: List[ArtSaleItemImage] = []
    user_display_name: Optional[str] = None
    user_avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


# ===== Course (講座) Schemas =====

class CourseCategoryEnum(str, Enum):
    business = "business"        # ビジネス
    creative = "creative"        # クリエイティブ
    language = "language"        # 語学
    health = "health"            # 健康
    relationship = "relationship"  # 恋愛・関係
    life = "life"                # ライフ
    other = "other"              # その他


class CourseImageBase(BaseModel):
    image_url: str
    sort_order: int = 0


class CourseImage(CourseImageBase):
    id: int
    
    class Config:
        from_attributes = True


class CourseVideoBase(BaseModel):
    youtube_url: str
    sort_order: int = 0


class CourseVideo(CourseVideoBase):
    id: int
    youtube_video_id: str
    
    class Config:
        from_attributes = True


class CourseBase(BaseModel):
    title: str
    description: str
    category: CourseCategoryEnum
    price_label: str
    external_url: str
    instructor_profile: Optional[str] = None  # 講師プロフィール（最大1000文字）


class CourseCreate(CourseBase):
    image_urls: Optional[List[str]] = None  # 最大5件
    youtube_urls: Optional[List[str]] = None  # 最大6件


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[CourseCategoryEnum] = None
    price_label: Optional[str] = None
    external_url: Optional[str] = None
    instructor_profile: Optional[str] = None  # 講師プロフィール（最大1000文字）
    image_urls: Optional[List[str]] = None  # 最大5件
    youtube_urls: Optional[List[str]] = None  # 最大6件


class Course(CourseBase):
    id: int
    owner_user_id: int
    published: bool
    created_at: datetime
    updated_at: datetime
    images: List[CourseImage] = []
    videos: List[CourseVideo] = []
    instructor_profile: Optional[str] = None
    owner_display_name: Optional[str] = None
    owner_avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


# ===== Post Translation Schemas =====

class PostTranslationBase(BaseModel):
    lang: str
    translated_title: Optional[str] = None
    translated_text: str


class PostTranslation(PostTranslationBase):
    id: int
    post_id: int
    provider: str
    error_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PostWithTranslation(BaseModel):
    """Post response with translation information."""
    id: int
    user_id: int
    title: Optional[str] = None
    body: str
    visibility: str
    youtube_url: Optional[str] = None
    media_id: Optional[int] = None
    media_url: Optional[str] = None
    media_urls: Optional[List[str]] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    post_type: str = "post"
    slug: Optional[str] = None
    status: str = "published"
    og_image_url: Optional[str] = None
    excerpt: Optional[str] = None
    goal_amount: Optional[int] = 0
    current_amount: Optional[int] = 0
    deadline: Optional[date] = None
    tourism_details: Optional[PostTourismDetails] = None
    created_at: datetime
    updated_at: datetime
    like_count: Optional[int] = 0
    comment_count: Optional[int] = 0
    user_display_name: Optional[str] = None
    # Translation fields
    original_lang: Optional[str] = None
    view_lang: str = "ja"
    display_title: Optional[str] = None
    display_text: str
    has_translation: bool = False
    is_translated: bool = False
    
    class Config:
        from_attributes = True
