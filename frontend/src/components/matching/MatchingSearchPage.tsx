import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, resilientFetch } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MatchCard } from './MatchCard';
import { BACKEND_URL } from '@/config';
import { UserCog, Heart } from 'lucide-react';

type MatchItem = {
  user_id: number;
  display_name?: string;
  identity?: string | null;
  nationality?: string | null;
  romance_targets?: string[];
  prefecture?: string | null;
  age_band?: string | null;
  avatar_url?: string | null;
  occupation?: string | null;
  meet_pref?: string | null;
  community_category?: string | null;
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'カテゴリー ▼' },
  { value: 'ゲイ', label: 'ゲイ' },
  { value: 'レズビアン', label: 'レズビアン' },
  { value: 'バイセクシュアル', label: 'バイセクシュアル' },
  { value: 'トランスジェンダー', label: 'トランスジェンダー' },
  { value: 'クィア', label: 'クィア' },
  { value: 'ストレート・アライ', label: 'ストレート・アライ' },
  { value: '男性', label: '男性' },
  { value: '女性', label: '女性' },
  { value: 'その他', label: 'その他' },
];

const AGE_BAND_OPTIONS = [
  { value: '', label: '年代 ▼' },
  { value: '10代', label: '10代' },
  { value: '20代前半', label: '20代前半' },
  { value: '20代後半', label: '20代後半' },
  { value: '30代前半', label: '30代前半' },
  { value: '30代後半', label: '30代後半' },
  { value: '40代前半', label: '40代前半' },
  { value: '40代後半', label: '40代後半' },
  { value: '50代前半', label: '50代前半' },
  { value: '50代後半', label: '50代後半' },
  { value: '60代以上', label: '60代以上' },
];

// 名誉会員: エスムラルダ(129)とTAKA(130)を常にトップに表示
const PINNED_USER_IDS = [129, 130];

const MatchingSearchPage: React.FC = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MatchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<MatchItem[]>([]);
  const [categoryRequired, setCategoryRequired] = useState(false);
  const [userCategory, setUserCategory] = useState<string | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedAgeBand, setSelectedAgeBand] = useState<string>("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [likedUserIds, setLikedUserIds] = useState<number[]>([]);
  
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  const fetchSearch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const merged: MatchItem[] = [];
      let page = 1;
      const size = 50;
      while (page <= 10) {
        const params = new URLSearchParams({ page: String(page), size: String(size), show_all: 'true', include_self: 'true' });
        const res = await resilientFetch(
          `/api/matching/search?${params.toString()}&_t=${Date.now()}`,
          { headers },
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data = await res.json();

        if (data.category_required) {
          setCategoryRequired(true);
          setUserCategory(null);
          setAllItems([]);
          setItems([]);
          setLoading(false);
          return;
        }
        if (data.user_category) {
          setUserCategory(data.user_category);
        }

        const batch: MatchItem[] = Array.isArray(data) ? data : data.items || [];
        merged.push(...batch);
        const total = typeof data.count === 'number' ? data.count : merged.length;
        if (batch.length < size || merged.length >= total) break;
        page += 1;
      }

      setCategoryRequired(false);
      let fetchedItems = merged;

      fetchedItems = fetchedItems.map((it) => {
        let avatar = it.avatar_url || '';
        if (avatar && !avatar.startsWith('http')) {
          avatar = `${BACKEND_URL}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
        }
        if (!avatar || avatar.includes('dicebear')) {
          avatar = '';
        }
        return { ...it, avatar_url: avatar };
      });
      
      // 名誉会員をトップに固定
      const pinned = fetchedItems.filter(it => PINNED_USER_IDS.includes(it.user_id));
      const others = fetchedItems.filter(it => !PINNED_USER_IDS.includes(it.user_id));
      pinned.sort((a, b) => PINNED_USER_IDS.indexOf(a.user_id) - PINNED_USER_IDS.indexOf(b.user_id));
      const sorted = [...pinned, ...others];
      
      setAllItems(sorted);
      setItems(sorted);
    } catch (e: any) {
      setError(e?.message || '検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearch();
    fetchLikes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchLikes = async () => {
    if (!token) return;
    try {
      const res = await resilientFetch('/api/matching/likes', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const likeItems = data.items || data || [];
        const ids = likeItems.map((item: { user_id?: number }) => item.user_id).filter(Boolean);
        setLikedUserIds(ids);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    let filtered = [...allItems];
    
    if (selectedCategory) {
      filtered = filtered.filter(it => {
        const cat = it.community_category || it.identity || '';
        return cat === selectedCategory;
      });
    }
    if (selectedAgeBand) {
      filtered = filtered.filter(it => it.age_band === selectedAgeBand);
    }
    if (showFavoritesOnly && likedUserIds.length > 0) {
      filtered = filtered.filter(it => likedUserIds.includes(it.user_id));
    }
    
    // フィルター後も名誉会員を常にトップに表示
    const pinned = filtered.filter(it => PINNED_USER_IDS.includes(it.user_id));
    const others = filtered.filter(it => !PINNED_USER_IDS.includes(it.user_id));
    pinned.sort((a, b) => PINNED_USER_IDS.indexOf(a.user_id) - PINNED_USER_IDS.indexOf(b.user_id));
    
    setItems([...pinned, ...others]);
  }, [allItems, selectedCategory, selectedAgeBand, showFavoritesOnly, likedUserIds]);

  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedAgeBand("");
    setShowFavoritesOnly(false);
  };

  // Category display name mapping
  const getCategoryDisplayName = (category: string | null): string => {
    if (!category) return '';
    const map: Record<string, string> = {
      'gay': t('matching.communityCategories.gay'),
      'ゲイ': t('matching.communityCategories.gay'),
      'lesbian': t('matching.communityCategories.lesbian'),
      'レズビアン': t('matching.communityCategories.lesbian'),
      'レズ': t('matching.communityCategories.lesbian'),
      'bisexual': t('matching.communityCategories.bisexual'),
      'バイセクシュアル': t('matching.communityCategories.bisexual'),
      'transgender': t('matching.communityCategories.transgender'),
      'トランスジェンダー': t('matching.communityCategories.transgender'),
      'questioning': t('matching.communityCategories.queer'),
      'クィア': t('matching.communityCategories.queer'),
      'クエスチョニング': t('matching.communityCategories.queer'),
      'other': t('matching.communityCategories.other'),
      'ストレート・アライ': t('matching.communityCategories.straightAlly'),
      'その他': t('matching.communityCategories.other'),
    };
    return map[category] || category;
  };

  if (!loading && categoryRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-pink-50/30">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">
            {t('matching.searchList')}
          </h1>
          <div className="flex flex-col items-center justify-center min-h-[400px] rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8">
            <UserCog className="h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              {t('matching.categoryRequired')}
            </h2>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              {t('matching.categoryRequiredMessage')}
            </p>
            <button
              onClick={() => navigate('/matching/profile')}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              {t('matching.goToProfileEdit')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-pink-50/30">
      <div className="mx-auto max-w-6xl px-2 sm:px-4 py-3 md:py-6">
        {/* Mobile: Title + Edit button + Inline filters */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-gray-900">
              会員交流
            </h1>
            <button
              onClick={() => navigate('/matching/profile')}
              className="text-sm font-medium bg-black text-white px-4 py-1.5 rounded-md hover:bg-gray-800 active:scale-95 transition-all"
            >
              編集
            </button>
          </div>
          {userCategory && (
            <p className="text-xs text-gray-500 mb-3">
              {t('matching.categoryFilterDescription', { category: getCategoryDisplayName(userCategory) })}
            </p>
          )}
          {/* Inline compact filters */}
          <div className="flex flex-col gap-2 mb-4">
            {/* 1段目: カテゴリー・年代・クリア */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={selectedAgeBand}
                onChange={(e) => setSelectedAgeBand(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                {AGE_BAND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {(selectedCategory || selectedAgeBand || showFavoritesOnly) && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  クリア
                </button>
              )}
            </div>
            {/* 2段目: お気に入りボタン */}
            {isPaidUser && (
              <div className="flex items-center">
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 transition-colors ${
                    showFavoritesOnly
                      ? 'bg-pink-50 border-pink-300 text-pink-600'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${showFavoritesOnly ? 'fill-pink-500 text-pink-500' : ''}`} />
                  お気に入り絞り込み
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: Title + Category heading */}
        <div className="hidden md:block">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            会員交流
          </h1>
          {userCategory && (
            <p className="mb-6 text-sm text-gray-600">
              {t('matching.categoryFilterDescription', { category: getCategoryDisplayName(userCategory) })}
            </p>
          )}
        </div>

        {/* Desktop Filter Section */}
        <div className="hidden md:block mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">検索条件</h3>
            {(selectedCategory || selectedAgeBand || showFavoritesOnly) && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                クリア
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリー</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.value === '' ? 'すべて' : opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">年代</label>
              <select
                value={selectedAgeBand}
                onChange={(e) => setSelectedAgeBand(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                {AGE_BAND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.value === '' ? 'すべて' : opt.label}</option>
                ))}
              </select>
            </div>
            {isPaidUser && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">お気に入り</label>
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
                    showFavoritesOnly
                      ? 'bg-pink-50 border-pink-300 text-pink-600'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${showFavoritesOnly ? 'fill-pink-500 text-pink-500' : ''}`} />
                  {showFavoritesOnly ? 'お気に入りのみ' : 'すべて表示'}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">{t('matching.loading')}</div>
          </div>
        )}
        
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600">
            {error}
          </div>
        )}
        
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {items.map((item) => (
              <MatchCard 
                key={item.user_id} 
                item={{
                  ...item,
                  isLiked: likedUserIds.includes(item.user_id)
                }}
                onUnlike={(userId) => setLikedUserIds(prev => prev.filter(id => id !== userId))}
              />
            ))}
          </div>
        )}
        
        {!loading && !error && items.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-600">{t('matching.noUsersFound')}</p>
              <p className="mt-2 text-sm text-gray-500">{t('matching.noUsersInCategory')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchingSearchPage;
