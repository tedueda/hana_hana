import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Heart } from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { MatchCard } from '@/components/matching/MatchCard';

interface MemberItem {
  user_id: number;
  display_name?: string;
  identity?: string | null;
  prefecture?: string | null;
  age_band?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  community_category?: string | null;
}

// エスムラルダ(129)とTAKA(130)を常にトップに表示
const PINNED_USER_IDS = [129, 130];
// テスト/ダミーユーザーを除外
const EXCLUDED_USER_IDS = [49, 50, 51, 52, 53, 54, 55, 56, 57, 103, 107, 127, 128];

const CATEGORY_OPTIONS = [
  { value: '', label: 'カテゴリー ▼' },
  { value: 'ゲイ', label: 'ゲイ' },
  { value: 'レズビアン', label: 'レズビアン' },
  { value: 'バイセクシュアル', label: 'バイセクシュアル' },
  { value: 'トランスジェンダー', label: 'トランスジェンダー' },
  { value: 'クィア', label: 'クィア' },
  { value: 'ストレート・アライ', label: 'ストレート・アライ' },
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

const MemberExchangeSection: React.FC = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [allMembers, setAllMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAgeBand, setSelectedAgeBand] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [likedUserIds, setLikedUserIds] = useState<number[]>([]);

  // 有料会員かどうか
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const allItems: MemberItem[] = [];

        if (token) {
          // ログイン済み: 認証付きAPIで取得
          const headers: Record<string, string> = {
            'Cache-Control': 'no-cache',
            'Authorization': `Bearer ${token}`,
          };
          let page = 1;
          const pageSize = 50;
          while (page <= 20) {
            const res = await fetch(
              `${API_URL}/api/matching/search?page=${page}&size=${pageSize}&show_all=true&include_self=true&_t=${Date.now()}`,
              { headers }
            );
            if (!res.ok) break;
            const data = await res.json();
            const items: MemberItem[] = Array.isArray(data) ? data : data.items || [];
            allItems.push(...items);
            if (items.length < pageSize) break;
            page++;
          }
        } else {
          // 未ログイン: 公開プレビューAPIで取得
          let page = 1;
          const pageSize = 50;
          while (page <= 20) {
            const res = await fetch(
              `${API_URL}/api/matching/public-preview?page=${page}&size=${pageSize}&_t=${Date.now()}`
            );
            if (!res.ok) break;
            const data = await res.json();
            const items: MemberItem[] = Array.isArray(data) ? data : data.items || [];
            allItems.push(...items);
            if (items.length < pageSize) break;
            page++;
          }
        }

        // テストユーザーを除外
        const filtered = allItems.filter(m => !EXCLUDED_USER_IDS.includes(m.user_id));

        // ピン留めユーザーをトップに配置
        const pinned = filtered.filter(m => PINNED_USER_IDS.includes(m.user_id));
        const others = filtered.filter(m => !PINNED_USER_IDS.includes(m.user_id));
        pinned.sort((a, b) => PINNED_USER_IDS.indexOf(a.user_id) - PINNED_USER_IDS.indexOf(b.user_id));
        const sorted = [...pinned, ...others];
        setAllMembers(sorted);
        setMembers(sorted);
      } catch (err) {
        console.error('Failed to fetch members:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();

    // お気に入り（いいね）ユーザーIDを取得
    const fetchLikes = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/matching/likes`, {
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
    fetchLikes();
  }, [token]);

  // フィルター適用
  useEffect(() => {
    let filtered = [...allMembers];
    if (selectedCategory) {
      filtered = filtered.filter(m => {
        const cat = m.community_category || m.identity || '';
        return cat === selectedCategory;
      });
    }
    if (selectedAgeBand) {
      filtered = filtered.filter(m => m.age_band === selectedAgeBand);
    }
    if (showFavoritesOnly && likedUserIds.length > 0) {
      filtered = filtered.filter(m => likedUserIds.includes(m.user_id));
    }
    // ピン留めユーザーは常にトップに
    const pinned = filtered.filter(m => PINNED_USER_IDS.includes(m.user_id));
    const others = filtered.filter(m => !PINNED_USER_IDS.includes(m.user_id));
    pinned.sort((a, b) => PINNED_USER_IDS.indexOf(a.user_id) - PINNED_USER_IDS.indexOf(b.user_id));
    setMembers([...pinned, ...others]);
  }, [allMembers, selectedCategory, selectedAgeBand, showFavoritesOnly, likedUserIds]);

  return (
    <section className="py-10 md:py-14">
      <div>
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-4 gap-2">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900">会員マッチング</h2>
            <p className="text-sm text-gray-500 mt-1">Caratに参加しているメンバーと気軽に交流できます</p>
          </div>
          <button
            onClick={() => navigate('/matching')}
            className="text-gray-600 hover:text-black font-medium text-sm flex items-center gap-1 self-start md:self-auto"
          >
            全て見る <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* フィルター */}
        <div className="flex items-center gap-2 mb-4">
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
          {isPaidUser && (
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`flex items-center gap-1 text-sm border rounded-lg px-2.5 py-1.5 transition-colors ${
                showFavoritesOnly
                  ? 'bg-pink-50 border-pink-300 text-pink-600'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${showFavoritesOnly ? 'fill-pink-500 text-pink-500' : ''}`} />
              お気に入り
            </button>
          )}
          {(selectedCategory || selectedAgeBand || showFavoritesOnly) && (
            <button
              onClick={() => { setSelectedCategory(''); setSelectedAgeBand(''); setShowFavoritesOnly(false); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              クリア
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : members.length > 0 ? (
          <div
            className="overflow-y-auto"
            style={{ maxHeight: '900px' }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {members.map((member) => (
                <MatchCard key={member.user_id} item={member} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            該当するメンバーがいません
          </div>
        )}

        {allMembers.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/matching')}
              className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              全て見る <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default MemberExchangeSection;
