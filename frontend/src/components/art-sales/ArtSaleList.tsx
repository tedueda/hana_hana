import React, { useState, useEffect } from 'react';
import { Plus, Grid, List, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import ArtSaleDetail from './ArtSaleDetail';
import ArtSalePostForm from './ArtSalePostForm';
import { API_URL } from '../../config';

interface ArtSaleItem {
  id: number;
  user_id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  technique: string | null;
  size: string | null;
  year_created: number | null;
  is_original: boolean;
  transaction_method: string;
  status: string;
  view_count: number;
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

const CATEGORY_LABELS: Record<string, string> = {
  painting: '絵画',
  sculpture: '彫刻',
  digital: 'デジタルアート',
  photography: '写真',
  calligraphy: '書道',
  crafts: '工芸',
  illustration: 'イラスト',
  other: 'その他',
};

const ArtSaleList: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  const [items, setItems] = useState<ArtSaleItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ArtSaleItem | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ArtSaleItem | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchItems();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/art-sales/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      
      const response = await fetch(`${API_URL}/api/art-sales/items?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: ArtSaleItem) => {
    setSelectedItem(null);
    setEditingItem(item);
    setShowPostForm(true);
  };

  const handlePostSuccess = () => {
    setShowPostForm(false);
    setEditingItem(null);
    fetchItems();
  };

  const handleNewPost = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isPaidUser) {
      navigate('/account');
      return;
    }
    setEditingItem(null);
    setShowPostForm(true);
  };

  const filteredItems = items.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatPrice = (price: number) => {
    if (price === 0) return t('artSales.negotiable');
    return `¥${price.toLocaleString()}`;
  };

  if (selectedItem) {
    return (
      <ArtSaleDetail
        item={selectedItem}
        onBack={() => {
          setSelectedItem(null);
          fetchItems();
        }}
        onEdit={handleEdit}
      />
    );
  }

  if (showPostForm) {
    return (
      <ArtSalePostForm
        categories={categories}
        editingItem={editingItem}
        onCancel={() => {
          setShowPostForm(false);
          setEditingItem(null);
        }}
        onSuccess={handlePostSuccess}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
        >
          ←戻る
        </button>
        <button
          type="button"
          onClick={handleNewPost}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          新規投稿
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">{t('artSales.title')}</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('artSales.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            aria-label={t('artSales.selectCategory')}
          >
            <option value="">{t('artSales.allCategories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {t(`artSales.categories.${cat.id}`, { defaultValue: CATEGORY_LABELS[cat.id] || cat.name })}
              </option>
            ))}
          </select>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-pink-100 text-pink-600' : 'bg-white text-gray-600'}`}
              aria-label={t('artSales.gridView')}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-pink-100 text-pink-600' : 'bg-white text-gray-600'}`}
              aria-label={t('artSales.listView')}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('artSales.noItemsFound')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="aspect-square bg-gray-100">
                {item.images && item.images.length > 0 ? (
                  <img
                    src={item.images[0].image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
                <p className="text-pink-600 font-bold">{formatPrice(item.price)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t(`artSales.categories.${item.category}`, { defaultValue: CATEGORY_LABELS[item.category] || item.category })}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex"
            >
              <div className="w-32 h-32 bg-gray-100 flex-shrink-0">
                {item.images && item.images.length > 0 ? (
                  <img
                    src={item.images[0].image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
              </div>
              <div className="p-4 flex-1">
                <h3 className="font-medium text-gray-900">{item.title}</h3>
                <p className="text-pink-600 font-bold text-lg">{formatPrice(item.price)}</p>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {t(`artSales.categories.${item.category}`, { defaultValue: CATEGORY_LABELS[item.category] || item.category })}
                  </span>
                  {item.is_original && (
                    <span className="text-xs bg-pink-100 text-pink-600 px-2 py-1 rounded">
                      {t('artSales.detail.original')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtSaleList;
