import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import PremiumUpgradeModal from '../PremiumUpgradeModal';
import { API_URL } from '../../config';

interface JewelryProduct {
  id: number;
  name: string;
  description: string;
  material?: string;
  size?: string;
  additional_info?: string;
  price: number;
  price_includes_tax: boolean;
  stock: number;
  is_active: boolean;
  category: string;
  has_certificate: boolean;
  has_gem_id: boolean;
  is_sold_out: boolean;
  images: { id: number; image_url: string; display_order: number }[];
  created_at: string;
}

interface User {
  id: number;
  membership_type: string;
}

const JewelryProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<JewelryProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchProduct();
    fetchUser();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await fetch(`${API_URL}/jewelry/products/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProduct(data);
      } else {
        navigate('/jewelry');
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
      navigate('/jewelry');
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        console.error('ユーザー情報の取得に失敗:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const handleAddToCart = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log('=== カート追加開始 ===');
    console.log('ユーザー情報:', user);
    console.log('商品ID:', product?.id);

    if (!user) {
      console.log('ユーザー未ログイン - ログインページへ');
      navigate('/login');
      return;
    }

    if (user.membership_type !== 'premium' && user.membership_type !== 'admin' && user.membership_type !== 'founder_free') {
      console.log('プレミアム会員ではない - モーダル表示');
      setShowPremiumModal(true);
      return;
    }

    setAddingToCart(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      console.log('トークン:', token ? '存在する' : '存在しない');
      console.log('APIエンドポイント:', `${API_URL}/jewelry/cart/items`);
      
      const response = await fetch(`${API_URL}/jewelry/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: product?.id,
          quantity: 1
        })
      });

      console.log('レスポンスステータス:', response.status);

      if (response.ok) {
        console.log('カート追加成功');
        setMessage({ type: 'success', text: 'カートに追加しました' });
        // カートページに遷移
        setTimeout(() => {
          console.log('カートページに遷移');
          navigate('/jewelry/cart');
        }, 1000);
      } else {
        const error = await response.json();
        console.error('カート追加失敗:', error);
        
        // 在庫不足エラーの場合は、既にカートに入っている可能性があるため、カートページに遷移
        if (error.detail && error.detail.includes('在庫が不足しています')) {
          setMessage({ type: 'success', text: 'この商品は既にカートに入っています' });
          setTimeout(() => {
            navigate('/jewelry/cart');
          }, 1000);
        } else {
          setMessage({ type: 'error', text: error.detail || 'カートへの追加に失敗しました' });
        }
      }
    } catch (error) {
      console.error('カート追加エラー:', error);
      setMessage({ type: 'error', text: 'カートへの追加に失敗しました' });
    } finally {
      setAddingToCart(false);
      console.log('=== カート追加終了 ===');
    }
  };

  const formatPrice = (price: number, includesTax: boolean) => {
    const formatted = price.toLocaleString('ja-JP');
    return `¥${formatted}${includesTax ? '（税込）' : '（税別）'}`;
  };

  const nextImage = () => {
    if (product && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    }
  };

  const prevImage = () => {
    if (product && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">商品が見つかりません</p>
      </div>
    );
  }

  const isSoldOut = product.stock === 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/jewelry')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>商品一覧に戻る</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Slider */}
        <div className="relative">
          <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative">
            {product.images && product.images.length > 0 ? (
              <>
                <img
                  src={product.images[currentImageIndex].image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 hover:bg-opacity-100"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 rounded-full p-2 hover:bg-opacity-100"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-24 h-24 text-gray-300" />
              </div>
            )}
            {isSoldOut && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">SOLD OUT</span>
              </div>
            )}
          </div>

          {/* Thumbnail Navigation */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              {product.images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                    index === currentImageIndex ? 'border-gray-800' : 'border-transparent'
                  }`}
                >
                  <img
                    src={image.image_url}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">{product.name}</h1>
          
          {/* Sold Out バッジ */}
          {product.is_sold_out && (
            <div className="inline-block px-4 py-2 bg-black text-white font-bold text-lg mb-4 rounded">
              Sold Out
            </div>
          )}
          
          <p className="text-3xl font-bold text-gray-900 mb-4">
            {formatPrice(product.price, product.price_includes_tax)}
          </p>

          {/* 鑑定証・宝石識別証バッジ */}
          {(product.has_certificate || product.has_gem_id) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {product.has_certificate && (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium border border-gray-300">
                  鑑定証あり
                </span>
              )}
              {product.has_gem_id && (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium border border-gray-300">
                  宝石識別証あり
                </span>
              )}
            </div>
          )}

          {/* Stock Info */}
          {product.stock > 0 && !product.is_sold_out && (
            <p className="text-sm text-gray-500 mb-4">
              在庫: {product.stock}点
            </p>
          )}


          {/* Message */}
          {message && (
            <div
              className={`p-4 rounded-lg mb-4 ${
                message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Cart Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={isSoldOut || addingToCart}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-4 rounded-lg font-bold text-lg ${
                isSoldOut
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-900 text-white hover:bg-black'
              }`}
            >
              <ShoppingCart className="w-6 h-6" />
              {addingToCart ? '追加中...' : isSoldOut ? '売り切れ' : 'カートに入れる'}
            </button>

            {user && (user.membership_type === 'premium' || user.membership_type === 'admin' || user.membership_type === 'founder_free') && (
              <button
                onClick={() => navigate('/jewelry/cart')}
                className="flex-1 py-4 border border-gray-900 text-gray-900 rounded-lg font-bold hover:bg-gray-100"
              >
                カートを見る
              </button>
            )}
          </div>

          {/* Product Details */}
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">商品詳細</h2>
            
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.description}</p>
            </div>

            {product.material && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800">素材</h3>
                <p className="text-sm text-gray-600">{product.material}</p>
              </div>
            )}

            {product.size && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800">サイズ</h3>
                <p className="text-sm text-gray-600">{product.size}</p>
              </div>
            )}

            {product.additional_info && (
              <div>
                <h3 className="font-semibold text-gray-700">その他</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{product.additional_info}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Premium Upgrade Modal */}
      {showPremiumModal && (
        <PremiumUpgradeModal
          open={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          featureName="ジュエリーの購入"
        />
      )}
    </div>
  );
};

export default JewelryProductDetail;
