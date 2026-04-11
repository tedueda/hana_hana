import React, { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, ChevronLeft, ChevronRight, X, Play, Trash2, Edit, MessageCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_URL } from '../../config';
import { translateText } from '../../services/translationService';
import PaidMemberUpgradeModal from '../PaidMemberUpgradeModal';

interface CourseImage {
  id: number;
  image_url: string;
  sort_order: number;
}

interface CourseVideo {
  id: number;
  youtube_url: string;
  youtube_video_id: string;
  sort_order: number;
}

interface Course {
  id: number;
  owner_user_id: number;
  title: string;
  description: string;
  category: string;
  price_label: string;
  external_url: string;
  instructor_profile: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
  images: CourseImage[];
  videos: CourseVideo[];
  owner_display_name: string | null;
  owner_avatar_url: string | null;
}

interface CourseDetailProps {
  course: Course;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  business: 'ビジネス',
  creative: 'クリエイティブ',
  language: '語学',
  health: '健康',
  relationship: '恋愛・関係',
  life: 'ライフ',
  other: 'その他',
};

const CourseDetail: React.FC<CourseDetailProps> = ({ course, onBack, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { user, token } = useAuth();
  const isOwner = user?.id === course.owner_user_id;
  const isAdmin = user?.membership_type === 'admin';
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const canEdit = isOwner || isAdmin;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(course.title);
  const [translatedDescription, setTranslatedDescription] = useState(course.description);
  const [translatedInstructorProfile, setTranslatedInstructorProfile] = useState(course.instructor_profile || '');

  useEffect(() => {
    const translateContent = async () => {
      if (currentLanguage === 'ja') {
        setTranslatedTitle(course.title);
        setTranslatedDescription(course.description);
        setTranslatedInstructorProfile(course.instructor_profile || '');
        return;
      }
      try {
        const promises = [
          translateText(course.title, currentLanguage),
          translateText(course.description, currentLanguage)
        ];
        if (course.instructor_profile) {
          promises.push(translateText(course.instructor_profile, currentLanguage));
        }
        const results = await Promise.all(promises);
        setTranslatedTitle(results[0].translated_text);
        setTranslatedDescription(results[1].translated_text);
        if (course.instructor_profile && results[2]) {
          setTranslatedInstructorProfile(results[2].translated_text);
        }
      } catch (error) {
        console.error('Translation error:', error);
      }
    };
    translateContent();
  }, [course.title, course.description, course.instructor_profile, currentLanguage]);

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? course.images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === course.images.length - 1 ? 0 : prev + 1
    );
  };

  const handleVideoClick = (videoId: string) => {
    setSelectedVideoId(videoId);
    setShowVideoModal(true);
  };

  const handleDelete = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/courses/${course.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        onDelete();
      } else {
        alert(t('courses.detail.deleteFailed'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(t('courses.detail.deleteFailed'));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
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
      const response = await fetch(`${API_URL}/api/courses/${course.id}/contact`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.chat_id) {
          // 既存のチャットがある場合
          navigate(`/matching/chats/${data.chat_id}`);
        } else if (data.status === 'pending') {
          // リクエスト送信済み
          alert(t('courses.detail.inquirySent'));
          navigate('/matching/chats');
        } else if (data.status === 'accepted') {
          // 承認済み
          navigate('/matching/chats');
        } else {
          alert(t('courses.detail.inquirySent'));
          navigate('/matching/chats');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.detail || t('courses.detail.chatStartFailed'));
      }
    } catch (error) {
      console.error('Chat start error:', error);
      alert(t('common.errorOccurred'));
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('courses.detail.backToList')}
        </button>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Edit className="w-4 h-4" />
              {t('common.edit')}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              {t('common.delete')}
            </button>
          </div>
        )}
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{translatedTitle}</h1>

      {/* Image Slider */}
      {course.images.length > 0 ? (
        <div className="relative mb-6">
          <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden">
            <img
              src={course.images[currentImageIndex].image_url}
              alt={`${course.title} - 画像 ${currentImageIndex + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
          {course.images.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                aria-label={t('courses.detail.previousImage')}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                aria-label={t('courses.detail.nextImage')}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {course.images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full ${
                      index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                    aria-label={`${t('courses.detail.image')} ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center mb-6">
          <span className="text-6xl">📚</span>
        </div>
      )}

      {/* Video Thumbnails */}
      {course.videos.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('courses.detail.demoVideos')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {course.videos.map((video) => (
              <button
                key={video.id}
                onClick={() => handleVideoClick(video.youtube_video_id)}
                className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden group"
              >
                <img
                  src={`https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`}
                  alt={t('courses.detail.videoThumbnail')}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                  <Play className="w-12 h-12 text-white" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      <div className="mb-4">
        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
          {t(`courses.categories.${course.category}`, { defaultValue: CATEGORY_LABELS[course.category] || course.category })}
        </span>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('courses.detail.description')}</h2>
        <p className="text-gray-700 whitespace-pre-wrap">{translatedDescription}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('courses.detail.price')}</h2>
        <p className="text-2xl font-bold text-gray-900">{course.price_label}</p>
      </div>

      {/* Instructor Profile */}
      {course.instructor_profile && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('courses.detail.instructorProfile')}</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{translatedInstructorProfile}</p>
        </div>
      )}

      {/* Instructor Info (会員限定でプロフィールリンク) */}
      <div className="mb-8 p-4 bg-gray-50 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('courses.detail.instructor')}</h2>
        {user ? (
          <button
            onClick={() => navigate(`/matching/users/${course.owner_user_id}`)}
            className="flex items-center gap-3 hover:bg-gray-100 p-2 -m-2 rounded-lg transition-colors w-full text-left"
          >
            {course.owner_avatar_url ? (
              <img
                src={course.owner_avatar_url}
                alt={course.owner_display_name || ''}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-500" />
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">
                {course.owner_display_name || t('common.anonymous')}
              </p>
              <p className="text-sm text-blue-600">{t('courses.detail.viewProfile')} →</p>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {course.owner_avatar_url ? (
              <img
                src={course.owner_avatar_url}
                alt={course.owner_display_name || ''}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-6 h-6 text-gray-500" />
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">
                {course.owner_display_name || t('common.anonymous')}
              </p>
              <p className="text-sm text-gray-500">{t('courses.detail.profileMembersOnly')}</p>
            </div>
          </div>
        )}
      </div>

      {/* CTA Buttons */}
      <div className="sticky bottom-4 bg-white p-4 rounded-xl shadow-lg border border-gray-200 space-y-3">
        {/* 投稿者に問い合わせボタン（自分の講座以外で表示） */}
        {!isOwner && (
          <button
            onClick={handleContact}
            disabled={contactLoading}
            className="flex items-center justify-center gap-2 w-full py-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium text-lg disabled:opacity-50"
          >
            <MessageCircle className="w-5 h-5" />
            {contactLoading ? t('courses.detail.connecting') : t('courses.detail.contactInstructor')}
          </button>
        )}
        {/* 講座サイトで申し込むボタン（有料会員のみ） */}
        {isPaidUser ? (
          <a
            href={course.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-lg"
          >
            <ExternalLink className="w-5 h-5" />
            {t('courses.detail.applyOnSite')}
          </a>
        ) : (
          <button
            onClick={() => {
              if (!user) {
                navigate('/login');
              } else {
                setShowUpgradeModal(true);
              }
            }}
            className="flex items-center justify-center gap-2 w-full py-4 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium text-lg"
          >
            <ExternalLink className="w-5 h-5" />
            {t('courses.detail.applyOnSitePremium')}
          </button>
        )}
      </div>

      {/* Upgrade Modal */}
      <PaidMemberUpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName={t('courses.detail.contactInstructor')}
      />

      {/* Video Modal */}
      {showVideoModal && selectedVideoId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300"
              aria-label={t('common.close')}
            >
              <X className="w-8 h-8" />
            </button>
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideoId}?autoplay=1`}
                title="YouTube video"
                className="w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{t('courses.detail.deleteConfirmTitle')}</h3>
            <p className="text-gray-600 mb-6">
              {t('courses.detail.deleteConfirmMessage')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetail;
