import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config';
import { useNavigate } from 'react-router-dom';
import { createApiClient } from '@/lib/apiClient';
import { navigateToComposeOrChat } from '@/lib/chatNavigation';
import { Lock } from 'lucide-react';

type LikeItem = {
  like_id: number;
  user_id: number;
  display_name: string;
  identity?: string | null;
  nationality?: string | null;
  prefecture?: string | null;
  age_band?: string | null;
  avatar_url?: string | null;
};

const getFlagImageUrl = (code: string | null | undefined): string => {
  if (!code || code === 'OTHER') return '';
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
};

type ViewMode = 'list' | 'grid';

const MatchingLikesPage: React.FC = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  // 有料会員かどうか
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LikeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('likesViewMode');
    return (saved === 'grid' || saved === 'list') ? saved : 'list';
  });

  const fetchLikes = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/matching/likes`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPaidUser) {
      fetchLikes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isPaidUser]);

  // 有料会員でない場合はアップグレード画面を表示
  if (!isPaidUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Lock className="h-16 w-16 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('matching.paidMemberOnly')}</h2>
        <p className="text-gray-600 mb-6 text-center">
          {t('matching.favoritesOnlyForPaidMembers')}
        </p>
        <button
          onClick={() => navigate('/account')}
          className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
        >
          {t('matching.becomePaidMember')}
        </button>
      </div>
    );
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('likesViewMode', mode);
  };

  const handleSendEmail = async (userId: number) => {
    if (!token) return;
    
    try {
      const apiClient = createApiClient(() => token);
      await navigateToComposeOrChat(apiClient, navigate, userId, user?.id || null);
    } catch (e: any) {
      alert(`エラー: ${e?.message || 'メール送信に失敗しました'}`);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t('matching.favoriteList')}</h2>
      <div className="p-4 border rounded-lg bg-white">
        <div className="mb-3 flex gap-2 items-center justify-between">
          <button onClick={fetchLikes} className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">{t('matching.refresh')}</button>
          <div className="flex gap-1 border border-gray-300 rounded">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-3 py-1 text-sm transition-colors ${viewMode === 'list' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {t('matching.list')}
            </button>
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`px-3 py-1 text-sm transition-colors ${viewMode === 'grid' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {t('matching.tile')}
            </button>
          </div>
        </div>
        {loading && <div>{t('matching.loading')}</div>}
        {error && <div className="text-red-600 text-sm">{error}</div>}
        
        {viewMode === 'list' ? (
          <ul className="space-y-2">
            {items.map((like) => (
              <li 
                key={like.like_id} 
                className="border rounded p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => navigate(`/matching/users/${like.user_id}`)}
              >
                <div className="flex items-center gap-3">
                  {like.avatar_url && like.avatar_url !== '' ? (
                    <img 
                      src={like.avatar_url.startsWith('http') ? like.avatar_url : `${API_URL}${like.avatar_url}`}
                      alt={like.display_name}
                      className="w-12 h-12 rounded-full object-cover bg-gray-200"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.onerror = null;
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23e5e7eb"/%3E%3Ctext x="50" y="65" font-size="50" text-anchor="middle" fill="%236b7280"%3E👤%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-500 text-xl">👤</span>
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{like.display_name}</div>
                    <div className="text-xs text-gray-600">
                      {[like.age_band, like.prefecture].filter(Boolean).join(' ・ ')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendEmail(like.user_id);
                  }}
                  className="px-3 py-1 text-sm bg-black text-white rounded hover:bg-gray-800 transition-colors"
                >
                  {t('matching.chat')}
                </button>
              </li>
            ))}
            {!loading && !error && items.length === 0 && (
              <li className="text-sm text-gray-500">{t('matching.noFavoritesYet')}</li>
            )}
          </ul>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((like) => (
              <div 
                key={like.like_id} 
                className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
                onClick={() => navigate(`/matching/users/${like.user_id}`)}
              >
                {/* 国旗バッジ（左上） */}
                {like.nationality && (
                  <div className="absolute left-2 top-2 bg-white/90 rounded-full px-1.5 py-1 shadow-sm z-10 flex items-center gap-1">
                    {getFlagImageUrl(like.nationality) && (
                      <img 
                        src={getFlagImageUrl(like.nationality)} 
                        alt={like.nationality}
                        className="w-6 h-4 object-cover rounded-sm"
                      />
                    )}
                    <span className="text-xs font-medium text-gray-700">{like.nationality}</span>
                  </div>
                )}
                {like.avatar_url && like.avatar_url !== '' ? (
                  <img 
                    src={like.avatar_url.startsWith('http') ? like.avatar_url : `${API_URL}${like.avatar_url}`}
                    alt={like.display_name}
                    className="w-full h-48 object-cover bg-gray-200"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.onerror = null;
                      target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="%239ca3af"%3E👤%3C/text%3E%3C/svg%3E';
                    }}
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-5xl">👤</span>
                  </div>
                )}
                <div className="p-3">
                  <div className="font-medium mb-1">{like.display_name}</div>
                  <div className="text-xs text-gray-600 mb-3">
                    {[like.age_band, like.prefecture].filter(Boolean).join(' ・ ')}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendEmail(like.user_id);
                    }}
                    className="w-full px-3 py-2 text-sm bg-black text-white rounded hover:bg-gray-800 transition-colors"
                  >
                    {t('matching.chat')}
                  </button>
                </div>
              </div>
            ))}
            {!loading && !error && items.length === 0 && (
              <div className="col-span-full text-sm text-gray-500 text-center py-8">{t('matching.noFavoritesYet')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchingLikesPage;
