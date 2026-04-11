import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, MessageCircle, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import PremiumUpgradeModal from '../PremiumUpgradeModal';
import { API_URL } from '../../config';
import { translateText } from '../../services/translationService';

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

interface FleaMarketDetailProps {
  item: FleaMarketItem;
  onBack: () => void;
  onRefresh: () => void;
}

const FleaMarketDetail: React.FC<FleaMarketDetailProps> = ({ item, onBack, onRefresh: _onRefresh }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const isOwner = user?.id === item.user_id;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(item.title);
  const [translatedDescription, setTranslatedDescription] = useState(item.description);

  useEffect(() => {
    const translateContent = async () => {
      if (currentLanguage === 'ja') {
        setTranslatedTitle(item.title);
        setTranslatedDescription(item.description);
        return;
      }
      try {
        const [titleResult, descResult] = await Promise.all([
          translateText(item.title, currentLanguage),
          translateText(item.description, currentLanguage)
        ]);
        setTranslatedTitle(titleResult.translated_text);
        setTranslatedDescription(descResult.translated_text);
      } catch (error) {
        console.error('Translation error:', error);
      }
    };
    translateContent();
  }, [item.title, item.description, currentLanguage]);

  const formatPrice = (price: number) => {
    if (price === 0) return t('fleaMarket.negotiable');
    return `¥${price.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handlePrevImage = () => {
    if (item.images && item.images.length > 0) {
      setCurrentImageIndex((prev) => (prev === 0 ? item.images.length - 1 : prev - 1));
    }
  };

  const handleNextImage = () => {
    if (item.images && item.images.length > 0) {
      setCurrentImageIndex((prev) => (prev === item.images.length - 1 ? 0 : prev + 1));
    }
  };

  const handleContact = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isPaidUser) {
      setShowUpgradeModal(true);
      return;
    }

    setContactLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/flea-market/chats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item_id: item.id }),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/matching/chats/${data.id}`);
      } else {
        const errorData = await response.json();
        if (errorData.detail === 'Chat already exists') {
          alert(t('fleaMarket.detail.chatAlreadyExists'));
          navigate('/matching/chats');
        } else {
          alert(errorData.detail || t('fleaMarket.detail.chatStartFailed'));
        }
      }
    } catch (error) {
      console.error('Chat start error:', error);
      alert(t('fleaMarket.detail.errorOccurred'));
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-700 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('fleaMarket.detail.backToList')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="relative">
          <div className="aspect-video bg-gray-100 relative">
            {item.images && item.images.length > 0 ? (
              <>
                <img
                  src={item.images[currentImageIndex].image_url}
                  alt={`${item.title} - ${currentImageIndex + 1}`}
                  className="w-full h-full object-contain"
                />
                {item.images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {item.images.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span className="text-6xl">📦</span>
              </div>
            )}
          </div>

          {item.images && item.images.length > 1 && (
            <div className="flex gap-2 p-4 overflow-x-auto">
              {item.images.map((img, index) => (
                <button
                  key={img.id}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    index === currentImageIndex ? 'border-gray-900' : 'border-transparent'
                  }`}
                >
                  <img
                    src={img.image_url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
              {t(`fleaMarket.categories.${item.category}`, { defaultValue: item.category })}
            </span>
            <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
              {t(`fleaMarket.transactionMethods.${item.transaction_method}`, { defaultValue: item.transaction_method })}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">{translatedTitle}</h1>

          <p className="text-3xl font-bold text-gray-900 mb-6">{formatPrice(item.price)}</p>

          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
            {item.region && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {item.region}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDate(item.created_at)}
            </span>
          </div>

          <div className="border-t border-gray-200 pt-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('fleaMarket.detail.productDescription')}</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{translatedDescription}</p>
          </div>

          <div className="border-t border-gray-200 pt-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('fleaMarket.detail.seller')}</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {item.user_avatar_url ? (
                  <img
                    src={item.user_avatar_url}
                    alt={item.user_display_name || t('fleaMarket.detail.seller')}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{item.user_display_name || t('fleaMarket.anonymousUser')}</p>
                <p className="text-sm text-gray-500">{t('fleaMarket.detail.member')}</p>
              </div>
            </div>
          </div>

          {!isOwner && (
            <button
              onClick={handleContact}
              disabled={contactLoading}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageCircle className="w-5 h-5" />
              {contactLoading ? t('fleaMarket.detail.processing') : t('fleaMarket.detail.contact')}
            </button>
          )}

          {isOwner && (
            <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-600">
              {t('fleaMarket.detail.yourListing')}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">{t('fleaMarket.detail.transactionNotes')}</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>・{t('fleaMarket.detail.note1')}</li>
          <li>・{t('fleaMarket.detail.note2')}</li>
          <li>・{t('fleaMarket.detail.note3')}</li>
        </ul>
      </div>

      <PremiumUpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName={t('fleaMarket.detail.contact')}
      />
    </div>
  );
};

export default FleaMarketDetail;
