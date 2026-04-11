import React, { useState, useEffect } from 'react';
import { Search, Plus, MapPin, Clock, Filter, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import FleaMarketPostForm from './FleaMarketPostForm';
import FleaMarketDetail from './FleaMarketDetail';
import PremiumUpgradeModal from '../PremiumUpgradeModal';
import { API_URL } from '../../config';

interface FleaMarketItem {
  id: number;
  user_id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  region: string | null;
  transaction_method: string;
  status: string;
  created_at: string;
  updated_at: string;
  images: { id: number; image_url: string; display_order: number }[];
  user_display_name: string | null;
  user_avatar_url: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Prefecture {
  id: string;
  name: string;
}

const FleaMarketList: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  // token removed - not currently used
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  const [items, setItems] = useState<FleaMarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [prefectures, setPrefectures] = useState<Prefecture[]>([]);
  
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  const [showPostForm, setShowPostForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FleaMarketItem | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchPrefectures();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [selectedCategory, selectedRegion, sortBy]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/flea-market/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('カテゴリ取得エラー:', error);
    }
  };

  const fetchPrefectures = async () => {
    try {
      const response = await fetch(`${API_URL}/api/flea-market/prefectures`);
      if (response.ok) {
        const data = await response.json();
        setPrefectures(data);
      }
    } catch (error) {
      console.error('都道府県取得エラー:', error);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKeyword) params.append('keyword', searchKeyword);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedRegion) params.append('region', selectedRegion);
      params.append('sort', sortBy);
      params.append('status', 'active');

      const response = await fetch(`${API_URL}/api/flea-market/items?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // APIは配列を直接返す
        setItems(Array.isArray(data) ? data : (data.items || []));
      }
    } catch (error) {
      console.error('商品取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const handlePostClick = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isPaidUser) {
      setShowUpgradeModal(true);
      return;
    }
    setShowPostForm(true);
  };

  const handleItemClick = (item: FleaMarketItem) => {
    setSelectedItem(item);
  };

  const handlePostSuccess = () => {
    setShowPostForm(false);
    fetchItems();
  };

  const formatPrice = (price: number) => {
    if (price === 0) return t('fleaMarket.negotiable');
    return `¥${price.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return t('fleaMarket.today');
    if (diffDays === 1) return t('fleaMarket.yesterday');
    if (diffDays < 7) return t('fleaMarket.daysAgo', { count: diffDays });
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  if (selectedItem) {
    return (
      <FleaMarketDetail
        item={selectedItem}
        onBack={() => setSelectedItem(null)}
        onRefresh={fetchItems}
      />
    );
  }

  if (showPostForm) {
    return (
      <FleaMarketPostForm
        categories={categories}
        prefectures={prefectures}
        onCancel={() => setShowPostForm(false)}
        onSuccess={handlePostSuccess}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
        >
          ←戻る
        </button>
        <button
          type="button"
          onClick={handlePostClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          新規投稿
        </button>
      </div>
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={t('fleaMarket.searchPlaceholder')}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900/20 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            {t('fleaMarket.search')}
          </button>
        </div>
      </form>

      <div className="mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <Filter className="w-5 h-5" />
          <span>{t('fleaMarket.filter')}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('fleaMarket.category')}</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900/20"
              >
                <option value="">{t('fleaMarket.all')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {t(`fleaMarket.categories.${cat.id}`, { defaultValue: cat.name })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('fleaMarket.region')}</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900/20"
              >
                <option value="">{t('fleaMarket.all')}</option>
                {prefectures.map((pref) => (
                  <option key={pref.id} value={pref.id}>
                    {pref.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('fleaMarket.sortBy')}</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900/20"
              >
                <option value="newest">{t('fleaMarket.sort.newest')}</option>
                <option value="price_asc">{t('fleaMarket.sort.priceAsc')}</option>
                <option value="price_desc">{t('fleaMarket.sort.priceDesc')}</option>
                <option value="negotiable">{t('fleaMarket.sort.negotiable')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('fleaMarket.loading')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">{t('fleaMarket.noItems')}</p>
          <button
            onClick={handlePostClick}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            {t('fleaMarket.createFirstListing')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="relative h-48 bg-gray-100">
                {item.images && item.images.length > 0 ? (
                  <img
                    src={item.images[0].image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-4xl">📦</span>
                  </div>
                )}
                {item.images && item.images.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {t('fleaMarket.moreImages', { count: item.images.length - 1 })}
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{item.title}</h3>
                <p className="text-xl font-bold text-gray-900 mb-2">{formatPrice(item.price)}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {item.region && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.region}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(item.created_at)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {t(`fleaMarket.categories.${item.category}`, { defaultValue: item.category })}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {t(`fleaMarket.transactionMethods.${item.transaction_method}`, { defaultValue: item.transaction_method })}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    {item.user_display_name || t('fleaMarket.anonymousUser')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PremiumUpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName={t('fleaMarket.listItem')}
      />
    </div>
  );
};

export default FleaMarketList;
