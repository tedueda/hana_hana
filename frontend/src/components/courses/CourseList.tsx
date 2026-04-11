import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ExternalLink, User, Filter, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';
import CourseDetail from './CourseDetail';
import CoursePostForm from './CoursePostForm';
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

interface Category {
  id: string;
  name: string;
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

const CourseList: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [showPostForm, setShowPostForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchCourses();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/courses/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);

      const response = await fetch(`${API_URL}/api/courses?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCourses(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
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
    setEditingCourse(null);
    setShowPostForm(true);
  };

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setShowPostForm(true);
    setSelectedCourse(null);
  };

  const handlePostSuccess = () => {
    setShowPostForm(false);
    setEditingCourse(null);
    fetchCourses();
  };

  const handleDeleteSuccess = () => {
    setSelectedCourse(null);
    fetchCourses();
  };

  const getFirstImageUrl = (course: Course) => {
    if (course.images && course.images.length > 0) {
      return course.images[0].image_url;
    }
    return null;
  };

  if (selectedCourse) {
    return (
      <CourseDetail
        course={selectedCourse}
        onBack={() => setSelectedCourse(null)}
        onEdit={() => handleEditCourse(selectedCourse)}
        onDelete={handleDeleteSuccess}
      />
    );
  }

  if (showPostForm) {
    return (
      <CoursePostForm
        course={editingCourse}
        onCancel={() => {
          setShowPostForm(false);
          setEditingCourse(null);
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
          onClick={handlePostClick}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          新規投稿
        </button>
      </div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('courses.title')}</h2>
          <p className="text-gray-600 mt-1">{t('courses.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-gray-700 font-medium"
        >
          <Filter className="w-5 h-5" />
          {t('courses.filter')}
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('courses.category')}</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                aria-label={t('courses.selectCategory')}
              >
                <option value="">{t('courses.allCategories')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {t(`courses.categories.${cat.id}`, { defaultValue: cat.name })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">{t('courses.noCourses')}</p>
          {isPaidUser && (
            <button
              onClick={handlePostClick}
              className="mt-4 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              {t('courses.listFirstCourse')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              onClick={() => handleCourseClick(course)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            >
              {/* Image */}
              <div className="aspect-video bg-gray-100 relative">
                {getFirstImageUrl(course) ? (
                  <img
                    src={getFirstImageUrl(course)!}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-4xl">📚</span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-1 bg-black/70 text-white text-xs rounded-full">
                    {t(`courses.categories.${course.category}`, { defaultValue: CATEGORY_LABELS[course.category] || course.category })}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                  {course.title}
                </h3>
                <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                  {course.description}
                </p>

                {/* Price */}
                <div className="text-lg font-bold text-gray-900 mb-3">
                  {course.price_label}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    {course.owner_avatar_url ? (
                      <img
                        src={course.owner_avatar_url}
                        alt={course.owner_display_name || ''}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <span className="text-sm text-gray-600">
                      {course.owner_display_name || t('common.anonymous')}
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upgrade Modal */}
      <PaidMemberUpgradeModal 
        open={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        featureName={t('courses.listCourse')}
      />
    </div>
  );
};

export default CourseList;
