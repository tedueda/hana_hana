import React, { useState, useEffect } from 'react';
import { Heart, MapPin, Clock, MessageCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '@/config';

interface Listing {
  id: number;
  title: string;
  description: string;
  price: number;
  condition: 'new' | 'like_new' | 'good' | 'fair';
  category: string;
  location: string;
  seller_name: string;
  seller_id: number;
  images: string[];
  created_at: string;
  status: 'active' | 'sold' | 'completed';
  is_favorited: boolean;
}

const conditionLabels: Record<string, string> = {
  new: '新品',
  like_new: '未使用に近い',
  good: '目立った傷や汚れなし',
  fair: 'やや傷や汚れあり'
};

const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const response = await fetch(`${API_URL}/api/posts/?category=marketplace`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // お気に入りのみフィルター
        const favoritedListings = data.filter((item: any) => item.is_liked);
        
        const listings: Listing[] = favoritedListings.map((item: any) => ({
          id: item.id,
          title: item.title || '無題',
          description: item.body || '',
          price: item.goal_amount || 0,
          condition: 'good',
          category: item.subcategory || 'その他',
          location: '大阪府',
          seller_name: item.user_display_name || '匿名',
          seller_id: item.user_id,
          images: item.media_urls && item.media_urls.length > 0 ? item.media_urls : ['/placeholder.jpg'],
          created_at: item.created_at,
          status: 'active',
          is_favorited: true
        }));
        
        setFavorites(listings);
      }
    } catch (error) {
      console.error('お気に入り取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (listingId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/posts/${listingId}/favorite`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setFavorites(favorites.filter(f => f.id !== listingId));
      }
    } catch (error) {
      console.error('お気に入り削除エラー:', error);
    }
  };

  const handleShowDetail = (listing: Listing) => {
    navigate('/members/marketplace', { state: { selectedListing: listing } });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays === 0) return '今日';
    if (diffDays === 1) return '昨日';
    return `${diffDays}日前`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-carat-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-carat-black mx-auto mb-4"></div>
          <p className="text-carat-gray5">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-carat-white">
      {/* Header */}
      <header className="bg-carat-white border-b border-carat-gray2 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/members/marketplace')}
              className="p-2 hover:bg-carat-gray1 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-carat-black">お気に入り</h1>
          </div>
        </div>
      </header>

      {/* Favorites Grid */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {favorites.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-carat-gray2 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-carat-gray4" />
              </div>
              <h3 className="text-lg font-semibold text-carat-black mb-2">お気に入りはまだありません</h3>
              <p className="text-carat-gray5 mb-6">気になる商品をお気に入りに追加しましょう</p>
              <button
                onClick={() => navigate('/members/marketplace')}
                className="bg-carat-black text-carat-white px-6 py-3 rounded-lg hover:bg-carat-gray6 transition-colors"
              >
                マーケットを見る
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((listing) => (
                <div
                  key={listing.id}
                  onClick={() => handleShowDetail(listing)}
                  className="bg-carat-white rounded-2xl shadow-card hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-carat-gray2 cursor-pointer"
                >
                  {/* Listing Image */}
                  <div className="relative h-48 bg-carat-gray2">
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute top-4 left-4 bg-carat-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-carat-gray6">
                      {conditionLabels[listing.condition]}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFavorite(listing.id);
                      }}
                      className="absolute top-4 right-4 p-2 rounded-full bg-pink-500 text-white transition-colors hover:bg-pink-600"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                  </div>

                  {/* Listing Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-bold text-carat-black mb-2 line-clamp-2">
                        {listing.title}
                      </h3>
                      <p className="text-2xl font-bold text-carat-black mb-2">¥{listing.price.toLocaleString()}</p>
                    </div>

                    <p className="text-carat-gray6 mb-4 text-sm line-clamp-2">
                      {listing.description}
                    </p>

                    {/* Listing Meta */}
                    <div className="flex items-center justify-between mb-4 text-sm text-carat-gray5">
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        <span>{listing.location}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        <span>{getTimeAgo(listing.created_at)}</span>
                      </div>
                    </div>

                    {/* Seller Info */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-carat-black rounded-full flex items-center justify-center text-carat-white text-sm font-bold">
                          {listing.seller_name.charAt(0)}
                        </div>
                        <span className="ml-2 text-sm text-carat-gray5">{listing.seller_name}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // チャット機能は後で実装
                      }}
                      className="w-full bg-carat-black text-carat-white py-2 px-3 rounded-lg font-medium hover:bg-carat-gray6 transition-all duration-300 flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-4 h-4" />
                      チャットで連絡
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default FavoritesPage;
