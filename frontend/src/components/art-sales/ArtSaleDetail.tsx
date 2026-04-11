import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, MessageCircle, ChevronLeft, ChevronRight, User, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import PremiumUpgradeModal from '../PremiumUpgradeModal';
import { translateText } from '../../services/translationService';
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

interface ArtSaleDetailProps {
  item: ArtSaleItem;
  onBack: () => void;
  onEdit?: (item: ArtSaleItem) => void;
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

const TRANSACTION_METHOD_LABELS: Record<string, string> = {
  hand_off: '手渡し',
  shipping: '発送',
  negotiable: '応相談',
};

const ArtSaleDetail: React.FC<ArtSaleDetailProps> = ({ item, onBack, onEdit }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const isOwner = user?.id === item.user_id;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
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
    if (price === 0) return '応相談';
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

  const handleContact = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isPaidUser) {
      setShowUpgradeModal(true);
      return;
    }
    navigate(`/matching/compose/${item.user_id}`);
  };

  const handleDelete = async () => {
    if (!confirm('この作品を削除しますか？')) {
      return;
    }

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/art-sales/items/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('作品を削除しました');
        onBack();
      } else {
        const errorData = await response.json();
        alert(errorData.detail || '削除に失敗しました');
      }
    } catch (error) {
      console.error('削除エラー:', error);
      alert('エラーが発生しました');
    } finally {
      setDeleteLoading(false);
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
          一覧に戻る
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
                      aria-label="前の画像"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                      aria-label="次の画像"
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
                          aria-label={`画像${index + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{translatedTitle}</h1>
              <p className="text-3xl font-bold text-pink-600">{formatPrice(item.price)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {CATEGORY_LABELS[item.category] || item.category}
              </span>
              {item.is_original && (
                <span className="px-3 py-1 bg-pink-100 text-pink-600 rounded-full text-sm text-center">
                  {t('artSales.detail.original')}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDate(item.created_at)}
            </div>
            {item.technique && (
              <div className="flex items-center gap-1">
                {t('artSales.detail.technique')}: {item.technique}
              </div>
            )}
            {item.size && (
              <div className="flex items-center gap-1">
                {t('artSales.detail.size')}: {item.size}
              </div>
            )}
            {item.year_created && (
              <div className="flex items-center gap-1">
                {t('artSales.detail.yearCreated')}: {item.year_created}{t('artSales.detail.year')}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('artSales.detail.description')}</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{translatedDescription}</p>
          </div>

          <div className="border-t border-gray-200 pt-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('artSales.detail.transactionMethod')}</h2>
            <p className="text-gray-700">
              {t(`artSales.transactionMethods.${item.transaction_method}`, { defaultValue: TRANSACTION_METHOD_LABELS[item.transaction_method] || item.transaction_method })}
            </p>
          </div>

          <div className="border-t border-gray-200 pt-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('artSales.detail.seller')}</h2>
            <div className="flex items-center gap-3">
              {item.user_avatar_url ? (
                <img
                  src={item.user_avatar_url}
                  alt={item.user_display_name || '出品者'}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">{item.user_display_name || t('common.anonymousUser')}</p>
                <p className="text-sm text-gray-500">{t('artSales.detail.member')}</p>
              </div>
            </div>
          </div>

          {!isOwner && (
            <button
              onClick={handleContact}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              {t('artSales.detail.contact')}
            </button>
          )}

          {isOwner && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-600 mb-3">
                {t('artSales.detail.yourListing')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onEdit ? onEdit(item) : alert('編集機能は近日実装予定です')}
                  className="py-3 px-4 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="w-5 h-5" />
                  {t('common.edit')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="py-3 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-5 h-5" />
                  {deleteLoading ? t('common.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2">{t('artSales.detail.transactionNotes')}</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>・{t('artSales.detail.note1')}</li>
              <li>・{t('artSales.detail.note2')}</li>
              <li>・{t('artSales.detail.note3')}</li>
            </ul>
          </div>
        </div>
      </div>

      <PremiumUpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="出品者への連絡"
      />
    </div>
  );
};

export default ArtSaleDetail;
