"""
Jewelry Shopping API Router
ジュエリーEC機能のAPIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime
import os

from app.database import get_db
from app.models import (
    User, JewelryProduct, JewelryProductImage, 
    Cart, CartItem, Order, OrderItem
)
from app.schemas import (
    JewelryProduct as JewelryProductSchema,
    JewelryProductCreate, JewelryProductUpdate,
    Cart as CartSchema, CartItem as CartItemSchema,
    CartItemCreate, CartItemUpdate,
    Order as OrderSchema, OrderCreate,
    CreatePaymentIntentRequest, CreatePaymentIntentResponse,
    ConfirmPaymentRequest
)
from app.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/jewelry", tags=["jewelry"])


def require_premium(user: User):
    """有料会員のみ許可"""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ログインが必要です"
        )
    if user.membership_type not in ["premium", "admin", "founder_free"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この機能は有料会員限定です"
        )


# ===== Product Endpoints =====

@router.get("/products", response_model=List[JewelryProductSchema])
def list_products(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """商品一覧を取得（誰でも閲覧可能）"""
    products = db.query(JewelryProduct).filter(
        JewelryProduct.is_active == True
    ).order_by(desc(JewelryProduct.created_at)).offset(skip).limit(limit).all()
    return products


@router.get("/products/{product_id}", response_model=JewelryProductSchema)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """商品詳細を取得（誰でも閲覧可能）"""
    product = db.query(JewelryProduct).filter(
        JewelryProduct.id == product_id,
        JewelryProduct.is_active == True
    ).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="商品が見つかりません"
        )
    return product


@router.post("/products", response_model=JewelryProductSchema)
def create_product(
    product_data: JewelryProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """商品を登録（管理者のみ）"""
    if current_user.membership_type != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理者のみ商品を登録できます"
        )
    
    product = JewelryProduct(
        name=product_data.name,
        description=product_data.description,
        material=product_data.material,
        size=product_data.size,
        additional_info=product_data.additional_info,
        price=product_data.price,
        price_includes_tax=product_data.price_includes_tax,
        stock=product_data.stock or 0,
        category="jewelry"
    )
    db.add(product)
    db.flush()
    
    # 画像を追加
    if product_data.image_urls:
        for i, url in enumerate(product_data.image_urls[:5]):
            image = JewelryProductImage(
                product_id=product.id,
                image_url=url,
                display_order=i
            )
            db.add(image)
    
    db.commit()
    db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=JewelryProductSchema)
def update_product(
    product_id: int,
    product_data: JewelryProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """商品を更新（管理者のみ）"""
    if current_user.membership_type != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理者のみ商品を更新できます"
        )
    
    product = db.query(JewelryProduct).filter(JewelryProduct.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="商品が見つかりません"
        )
    
    update_data = product_data.model_dump(exclude_unset=True)
    image_urls = update_data.pop("image_urls", None)
    
    for key, value in update_data.items():
        setattr(product, key, value)
    
    # 画像を更新
    if image_urls is not None:
        # 既存の画像を削除
        db.query(JewelryProductImage).filter(
            JewelryProductImage.product_id == product_id
        ).delete()
        # 新しい画像を追加
        for i, url in enumerate(image_urls[:5]):
            image = JewelryProductImage(
                product_id=product.id,
                image_url=url,
                display_order=i
            )
            db.add(image)
    
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """商品を削除（管理者のみ）"""
    if current_user.membership_type != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理者のみ商品を削除できます"
        )
    
    product = db.query(JewelryProduct).filter(JewelryProduct.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="商品が見つかりません"
        )
    
    # 論理削除
    product.is_active = False
    db.commit()
    return {"message": "商品を削除しました"}


# ===== Cart Endpoints =====

def get_or_create_cart(user_id: int, db: Session) -> Cart:
    """ユーザーのカートを取得または作成"""
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def calculate_cart_total(cart: Cart) -> int:
    """カートの合計金額を計算"""
    total = 0
    for item in cart.items:
        if item.product and item.product.is_active:
            total += item.product.price * item.quantity
    return total


@router.get("/cart", response_model=CartSchema)
def get_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """カートを取得（有料会員のみ）"""
    require_premium(current_user)
    
    cart = get_or_create_cart(current_user.id, db)
    
    # 合計金額を計算
    cart_dict = {
        "id": cart.id,
        "user_id": cart.user_id,
        "created_at": cart.created_at,
        "updated_at": cart.updated_at,
        "items": cart.items,
        "total_amount": calculate_cart_total(cart)
    }
    return cart_dict


@router.post("/cart/items", response_model=CartItemSchema)
def add_to_cart(
    item_data: CartItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """カートに商品を追加（有料会員のみ）"""
    require_premium(current_user)
    
    # 商品の存在確認
    product = db.query(JewelryProduct).filter(
        JewelryProduct.id == item_data.product_id,
        JewelryProduct.is_active == True
    ).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="商品が見つかりません"
        )
    
    # 在庫確認
    if product.stock > 0 and item_data.quantity > product.stock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"在庫が不足しています（残り{product.stock}個）"
        )
    
    cart = get_or_create_cart(current_user.id, db)
    
    # 既存のカートアイテムを確認
    existing_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == item_data.product_id
    ).first()
    
    if existing_item:
        # 数量を更新
        new_quantity = existing_item.quantity + item_data.quantity
        if product.stock > 0 and new_quantity > product.stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"在庫が不足しています（残り{product.stock}個）"
            )
        existing_item.quantity = new_quantity
        db.commit()
        db.refresh(existing_item)
        return existing_item
    else:
        # 新規追加
        cart_item = CartItem(
            cart_id=cart.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity
        )
        db.add(cart_item)
        db.commit()
        db.refresh(cart_item)
        return cart_item


@router.put("/cart/items/{item_id}", response_model=CartItemSchema)
def update_cart_item(
    item_id: int,
    item_data: CartItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """カートアイテムの数量を更新（有料会員のみ）"""
    require_premium(current_user)
    
    cart = get_or_create_cart(current_user.id, db)
    cart_item = db.query(CartItem).filter(
        CartItem.id == item_id,
        CartItem.cart_id == cart.id
    ).first()
    
    if not cart_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="カートアイテムが見つかりません"
        )
    
    # 在庫確認
    if cart_item.product.stock > 0 and item_data.quantity > cart_item.product.stock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"在庫が不足しています（残り{cart_item.product.stock}個）"
        )
    
    if item_data.quantity <= 0:
        # 数量が0以下なら削除
        db.delete(cart_item)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_200_OK,
            detail="カートから削除しました"
        )
    
    cart_item.quantity = item_data.quantity
    db.commit()
    db.refresh(cart_item)
    return cart_item


@router.delete("/cart/items/{item_id}")
def remove_from_cart(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """カートから商品を削除（有料会員のみ）"""
    require_premium(current_user)
    
    cart = get_or_create_cart(current_user.id, db)
    cart_item = db.query(CartItem).filter(
        CartItem.id == item_id,
        CartItem.cart_id == cart.id
    ).first()
    
    if not cart_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="カートアイテムが見つかりません"
        )
    
    db.delete(cart_item)
    db.commit()
    return {"message": "カートから削除しました"}


@router.delete("/cart")
def clear_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """カートを空にする（有料会員のみ）"""
    require_premium(current_user)
    
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        db.commit()
    
    return {"message": "カートを空にしました"}


# ===== Order Endpoints =====

@router.post("/orders", response_model=OrderSchema)
def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """注文を作成（有料会員のみ）"""
    require_premium(current_user)
    
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart or not cart.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="カートが空です"
        )
    
    # 在庫確認
    for item in cart.items:
        if not item.product or not item.product.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"商品「{item.product.name if item.product else '不明'}」は現在販売されていません"
            )
        if item.product.stock > 0 and item.quantity > item.product.stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"商品「{item.product.name}」の在庫が不足しています（残り{item.product.stock}個）"
            )
    
    # 合計金額を計算
    total_amount = calculate_cart_total(cart)
    
    # 注文を作成
    shipping = order_data.shipping_info
    order = Order(
        user_id=current_user.id,
        status="pending",
        total_amount=total_amount,
        recipient_name=shipping.recipient_name,
        postal_code=shipping.postal_code,
        address=shipping.address,
        phone=shipping.phone,
        email=shipping.email or current_user.email
    )
    db.add(order)
    db.flush()
    
    # 注文アイテムを作成
    for cart_item in cart.items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=cart_item.product_id,
            product_name=cart_item.product.name,
            price=cart_item.product.price,
            quantity=cart_item.quantity
        )
        db.add(order_item)
        
        # 在庫を減らす
        if cart_item.product.stock > 0:
            cart_item.product.stock -= cart_item.quantity
    
    # カートを空にする
    db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
    
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=List[OrderSchema])
def list_orders(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """注文履歴を取得（有料会員のみ）"""
    require_premium(current_user)
    
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(desc(Order.created_at)).offset(skip).limit(limit).all()
    return orders


@router.get("/orders/{order_id}", response_model=OrderSchema)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """注文詳細を取得（有料会員のみ）"""
    require_premium(current_user)
    
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="注文が見つかりません"
        )
    
    return order


# ===== Stripe Payment Endpoints =====

@router.post("/payments/create-intent", response_model=CreatePaymentIntentResponse)
def create_payment_intent(
    request: CreatePaymentIntentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stripe PaymentIntentを作成（有料会員のみ）"""
    require_premium(current_user)
    
    order = db.query(Order).filter(
        Order.id == request.order_id,
        Order.user_id == current_user.id,
        Order.status == "pending"
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="注文が見つかりません"
        )
    
    # Stripe APIキーを取得
    stripe_secret_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="決済システムが設定されていません"
        )
    
    try:
        import stripe
        stripe.api_key = stripe_secret_key
        
        # PaymentIntentを作成
        intent = stripe.PaymentIntent.create(
            amount=order.total_amount,
            currency="jpy",
            metadata={
                "order_id": order.id,
                "user_id": current_user.id
            }
        )
        
        # 注文にPaymentIntent IDを保存
        order.stripe_payment_intent_id = intent.id
        db.commit()
        
        return CreatePaymentIntentResponse(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount=order.total_amount
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"決済の初期化に失敗しました: {str(e)}"
        )


@router.post("/payments/confirm")
def confirm_payment(
    request: ConfirmPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """決済完了を確認（有料会員のみ）"""
    require_premium(current_user)
    
    order = db.query(Order).filter(
        Order.id == request.order_id,
        Order.user_id == current_user.id,
        Order.stripe_payment_intent_id == request.payment_intent_id
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="注文が見つかりません"
        )
    
    # Stripe APIキーを取得
    stripe_secret_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="決済システムが設定されていません"
        )
    
    try:
        import stripe
        stripe.api_key = stripe_secret_key
        
        # PaymentIntentの状態を確認
        intent = stripe.PaymentIntent.retrieve(request.payment_intent_id)
        
        if intent.status == "succeeded":
            order.status = "paid"
            order.paid_at = datetime.utcnow()
            if intent.latest_charge:
                order.stripe_charge_id = intent.latest_charge
            db.commit()
            return {"message": "決済が完了しました", "order_id": order.id}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"決済が完了していません（状態: {intent.status}）"
            )
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"決済の確認に失敗しました: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"エラーが発生しました: {str(e)}"
        )


# ===== Webhook for Stripe =====

@router.post("/webhooks/stripe")
async def stripe_webhook(
    request_body: bytes = Depends(lambda request: request.body()),
    db: Session = Depends(get_db)
):
    """Stripe Webhookを処理"""
    stripe_secret_key = os.environ.get("STRIPE_SECRET_KEY")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    
    if not stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="決済システムが設定されていません"
        )
    
    try:
        import stripe
        stripe.api_key = stripe_secret_key
        
        # Webhookの署名を検証（本番環境では必須）
        if webhook_secret:
            from fastapi import Request
            # signature = request.headers.get("stripe-signature")
            # event = stripe.Webhook.construct_event(request_body, signature, webhook_secret)
            pass
        
        # イベントを処理
        # event_type = event.get("type")
        # if event_type == "payment_intent.succeeded":
        #     payment_intent = event.data.object
        #     order_id = payment_intent.metadata.get("order_id")
        #     ...
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
