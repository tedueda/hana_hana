import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config';
import { createApiClient } from '@/lib/apiClient';
import { navigateToComposeOrChat } from '@/lib/chatNavigation';
import { Lock } from 'lucide-react';

type UserProfile = {
  user_id: number;
  display_name: string;
  nickname?: string;
  avatar_url?: string;
  nationality?: string;
  age_band?: string;
  prefecture?: string;
  residence_detail?: string;
  hometown?: string;
  occupation?: string;
  blood_type?: string;
  zodiac?: string;
  meet_pref?: string;
  bio?: string;
  identity?: string;
  romance_targets?: string[];
  hobbies?: string[];
  images?: Array<{ id: number; image_url: string; order?: number }>;
};

const getFlagImageUrl = (code: string | null | undefined): string => {
  if (!code || code === 'OTHER') return '';
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
};

const MatchingUserProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  // 有料会員かどうか
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token || !userId || !isPaidUser) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/matching/profiles/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('プロフィールの取得に失敗しました');
        const data = await res.json();
        const normalizedData = {
          ...data,
          images: (data.images || []).map((img: any) => ({
            id: img.id,
            image_url: img.image_url ?? img.url,
            order: img.order ?? img.display_order,
          })),
        };
        setProfile(normalizedData);
      } catch (e: any) {
        setError(e?.message || 'エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, userId, isPaidUser]);

  // 有料会員でない場合はアップグレード画面を表示
  if (!isPaidUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Lock className="h-16 w-16 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('matching.paidMemberOnly')}</h2>
        <p className="text-gray-600 mb-6 text-center">
          {t('matching.profileViewOnlyForPaidMembers')}
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

  const handleSendMessage = async () => {
    if (!token || !userId) return;
    
    try {
      const apiClient = createApiClient(() => token);
      await navigateToComposeOrChat(apiClient, navigate, parseInt(userId), user?.id || null);
    } catch (e) {
      console.error('Failed to navigate to chat:', e);
      alert(t('matching.errorOccurred'));
    }
  };

  const handleLike = async () => {
    if (!token || !userId) return;
    try {
      const res = await fetch(`${API_URL}/api/matching/likes/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t('matching.likeFailed'));
      alert(`❤️ ${t('matching.likeSent')}`);
      navigate('/matching/matches');
    } catch (e: any) {
      alert(`${t('matching.errorOccurred')}: ${e?.message || t('matching.likeFailed')}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">{t('matching.loading')}</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">{error || t('matching.profileNotFound')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-10">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 hover:text-black"
        >
          ← {t('matching.back')}
        </button>
        <h1 className="text-lg font-semibold text-black">{profile.display_name}</h1>
      </div>

      {/* Profile Content */}
      <div className="max-w-2xl mx-auto">
        {/* Image Gallery */}
        <div className="relative mx-auto max-w-xl md:max-w-2xl max-h-[420px] md:max-h-[480px] aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 mb-4 md:mb-0">
          {/* 国旗バッジ（左上） */}
          {profile.nationality && (
            <div className="absolute left-3 top-3 bg-white/90 rounded-full px-2 py-1.5 shadow-md z-20 flex items-center gap-1.5">
              {getFlagImageUrl(profile.nationality) && (
                <img 
                  src={getFlagImageUrl(profile.nationality)} 
                  alt={profile.nationality}
                  className="w-8 h-5 object-cover rounded-sm"
                />
              )}
              <span className="text-sm font-medium text-gray-700">{profile.nationality}</span>
            </div>
          )}
          {profile.images && profile.images.length > 0 ? (
            <>
              <img
                src={profile.images[currentImageIndex].image_url && profile.images[currentImageIndex].image_url.startsWith('http') 
                  ? profile.images[currentImageIndex].image_url 
                  : profile.images[currentImageIndex].image_url 
                    ? `${API_URL}${profile.images[currentImageIndex].image_url}`
                    : ''}
                alt={`${profile.display_name} - ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              {profile.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev - 1 + profile.images!.length) % profile.images!.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev + 1) % profile.images!.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    →
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {profile.images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : profile.avatar_url ? (
            <img
              src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `${API_URL}${profile.avatar_url}`}
              alt={profile.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-6xl">😊</span>
            </div>
          )}
        </div>

        {/* Mobile Action Buttons - Below Image */}
        <div className="md:hidden px-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={handleLike}
              className="rounded-lg px-4 py-2.5 text-sm font-medium transition-all bg-black text-white hover:bg-gray-800 active:scale-95"
            >
              ♡ {t('matching.favorite')}
            </button>
            <button
              onClick={handleSendMessage}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-all bg-white hover:bg-gray-50 active:scale-95 border border-gray-300"
            >
              {t('matching.chat')}
            </button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black mb-2">{profile.display_name}</h2>
            {profile.nickname && profile.nickname !== profile.display_name && (
              <div className="text-gray-600 mb-2">{t('matching.nickname')}: {profile.nickname}</div>
            )}
            <div className="text-gray-600 space-y-1">
              {profile.age_band && <div>{t('matching.age')}: {profile.age_band}</div>}
              {profile.prefecture && (
                <div>
                  {t('matching.residenceLocation')}: {profile.prefecture}
                  {profile.residence_detail && ` ${profile.residence_detail}`}
                </div>
              )}
              {profile.hometown && <div>{t('matching.hometown')}: {profile.hometown}</div>}
              {profile.occupation && <div>{t('matching.occupation')}: {profile.occupation}</div>}
              <div>{t('matching.bloodType')}: {profile.blood_type || t('matching.notSet')}</div>
              <div>{t('matching.zodiac')}: {profile.zodiac || t('matching.notSet')}</div>
            </div>
          </div>

          {/* Identity & Romance Targets */}
          {profile.identity && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-3">{t('matching.identity')}</h3>
              <div className="text-gray-700">{profile.identity}</div>
            </div>
          )}

          {profile.romance_targets && profile.romance_targets.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-3">{t('matching.romanceTargetsLabel')}</h3>
              <div className="flex flex-wrap gap-2">
                {profile.romance_targets.map((target, idx) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm border border-gray-200">
                    {target}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Meet Preference */}
          {profile.meet_pref && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-3">{t('matching.meetingPurpose')}</h3>
              <div className="text-gray-700">{profile.meet_pref}</div>
            </div>
          )}

          {/* Self Introduction */}
          {profile.bio && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-3">{t('matching.selfIntroduction')}</h3>
              <div className="text-gray-700 whitespace-pre-wrap">{profile.bio}</div>
            </div>
          )}

          {/* Hobbies */}
          {profile.hobbies && profile.hobbies.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-black mb-3">{t('matching.hobbies')}</h3>
              <div className="flex flex-wrap gap-2">
                {profile.hobbies.map((hobby, idx) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm border border-gray-200">
                    {hobby}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Sticky Bottom Action Bar */}
      <div className="hidden md:block fixed bottom-4 left-4 right-4 z-30">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={handleLike}
            className="flex-1 rounded-full px-6 py-4 text-base font-semibold transition-all bg-black text-white hover:bg-gray-800 active:scale-95 shadow-xl"
          >
            ♡ {t('matching.favorite')}
          </button>
          <button
            onClick={handleSendMessage}
            className="flex-1 rounded-full px-6 py-4 text-base font-semibold text-gray-800 transition-all bg-white hover:bg-gray-50 active:scale-95 shadow-xl border border-gray-200"
          >
            💬 {t('matching.chat')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchingUserProfilePage;
