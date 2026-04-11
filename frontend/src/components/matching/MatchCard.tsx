import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IdentityBadge } from "@/components/ui/IdentityBadge";
import { API_URL } from "@/config";
import { createApiClient } from "@/lib/apiClient";
import { navigateToComposeOrChat } from "@/lib/chatNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { Lock } from "lucide-react";

type Item = {
  user_id: number;
  display_name?: string;
  identity?: string | null;
  nationality?: string | null;
  prefecture?: string | null;
  age_band?: string | null;
  avatar_url?: string | null;
};

const getFlagImageUrl = (code: string | null | undefined): string => {
  if (!code || code === 'OTHER') return '';
  // Use flagcdn.com for reliable flag images
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
};

export function MatchCard({ item }: { item: Item }) {
  const { t } = useTranslation();
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  // 有料会員かどうか
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const isLoggedIn = !!user;

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    if (!isPaidUser) {
      setShowUpgradeModal(true);
      return;
    }
    if (loading || liked) return;
    
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch(`${API_URL}/api/matching/likes/${item.user_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) throw new Error('Like failed');
      const data = await res.json();
      setLiked(true);
      
      if (data.matched) {
        alert(`✨ ${t('matching.matched')}`);
        navigate('/matching/matches');
      } else {
        navigate('/matching/likes');
      }
    } catch (err) {
      console.error("Like failed:", err);
      alert(t('matching.likeFailed'));
    } finally {
      setLoading(false);
    }
  }
  function handleCardClick() {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    if (!isPaidUser) {
      setShowUpgradeModal(true);
      return;
    }
    navigate(`/matching/users/${item.user_id}`);
  }

  async function handleMessage(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    if (!isPaidUser) {
      setShowUpgradeModal(true);
      return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      navigate(`/matching/compose/${item.user_id}`);
      return;
    }
    
    try {
      const apiClient = createApiClient(() => token);
      const userStr = localStorage.getItem('user');
      const currentUserId = userStr ? JSON.parse(userStr).id : null;
      await navigateToComposeOrChat(apiClient, navigate, item.user_id, currentUserId);
    } catch (err) {
      console.error('Failed to navigate to chat:', err);
      alert(t('matching.errorOccurred'));
    }
  }

  return (
    <>
    {showLoginModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
        <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <Lock className="h-12 w-12 mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('matching.loginRequired')}</h3>
            <p className="text-gray-600 mb-4 text-sm">
              {t('matching.loginRequiredMessage')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLoginModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('common.close')}
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                {t('auth.login')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {showUpgradeModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
        <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <Lock className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('matching.paidMemberOnly')}</h3>
            <p className="text-gray-600 mb-4 text-sm">
              {t('matching.paidMemberOnlyMessage')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('common.close')}
              </button>
              <button
                onClick={() => navigate('/account')}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                {t('matching.becomePaidMember')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    <article
      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md cursor-pointer"
      onClick={handleCardClick}
    >
      {/* 画像エリア - 縦長レイアウト */}
      <div className="block relative aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200">
        {item.avatar_url && !item.avatar_url.includes('dicebear') ? (
          <img
            src={item.avatar_url.startsWith('http') ? item.avatar_url : `${API_URL}${item.avatar_url}`}
            alt={`${item.display_name || "ユーザー"}のプロフィール画像`}
            className="h-full w-full object-cover"
            loading="lazy"
            key={`${item.user_id}-${item.avatar_url}`}
            onError={(e) => {
              // エラー時は画像を非表示にする
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-200">
            <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center">
              <span className="text-white text-xl">👤</span>
            </div>
          </div>
        )}
        
        {/* 国旗バッジ（左上） */}
        {item.nationality && (
          <div className="absolute left-2 top-2 bg-white/90 rounded-full px-1.5 py-1 shadow-sm z-10 flex items-center gap-1">
            {getFlagImageUrl(item.nationality) ? (
              <img 
                src={getFlagImageUrl(item.nationality)} 
                alt={item.nationality}
                className="w-6 h-4 object-cover rounded-sm"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const span = target.nextElementSibling as HTMLSpanElement;
                  if (span) span.style.display = 'inline';
                }}
              />
            ) : null}
            <span className="text-xs font-medium text-gray-700">{item.nationality}</span>
          </div>
        )}
        
        {/* 性自認バッジ（右上） */}
        {item.identity && (
          <div className="absolute right-2 top-2">
            <IdentityBadge value={item.identity} />
          </div>
        )}
        
        {/* 下部情報オーバーレイ */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-sm font-bold truncate">{item.display_name || `User ${item.user_id}`}</span>
            <span className="text-xs opacity-90">{item.age_band}</span>
          </div>
          <div className="text-xs opacity-75">
            📍 {item.prefecture}
          </div>
        </div>
      </div>

      {/* アクションボタン - コンパクト */}
      <div className="p-2">
        <div className="flex gap-1">
          <button
            onClick={handleLike}
            disabled={loading || liked}
            aria-label={`${item.display_name || "このユーザー"}をお気に入りに追加`}
            className={`
              flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all
              ${liked 
                ? "bg-gray-100 text-gray-500 cursor-not-allowed" 
                : "bg-black text-white hover:bg-gray-800 active:scale-95"
              }
              ${loading ? "opacity-50 cursor-wait" : ""}
            `}
          >
            💎 {t('matching.favorite')}
          </button>
          <button
            onClick={handleMessage}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-center text-xs font-medium text-gray-700 transition-all hover:bg-gray-100 active:scale-95"
            aria-label={`${item.display_name || "User"}${t('matching.chat')}`}
          >
            {t('matching.chat')}
          </button>
        </div>
      </div>
    </article>
    </>
  );
}

export default MatchCard;
