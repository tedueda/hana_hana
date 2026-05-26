import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Plus, ArrowLeft, ChevronRight } from 'lucide-react';
import { API_URL } from '../../config';

interface SalonCategory {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  group_name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  warning_text: string | null;
  room_count: number;
}

const GROUP_ORDER = [
  'エンタメ・カルチャー',
  'ライフスタイル',
  '社会・知識',
  '大人向け・ディープテーマ',
  'スポーツ',
];

const SalonPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<SalonCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/salon/categories`);
        if (res.ok) {
          setCategories(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch salon categories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const grouped = GROUP_ORDER.map(groupName => ({
    groupName,
    items: categories.filter(c => c.group_name === groupName),
  })).filter(g => g.items.length > 0);

  const handleCategoryClick = (categoryId: number) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isPaidUser) {
      navigate('/account');
      return;
    }
    navigate(`/salon/category/${categoryId}`);
  };

  const handleCreateRoom = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!isPaidUser) {
      navigate('/account');
      return;
    }
    navigate('/salon/create');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/feed')}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <Button
            onClick={handleCreateRoom}
            className="bg-black hover:bg-gray-800 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            サロンを作成する
          </Button>
        </div>

        {/* Title & Description */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-3">
            会員サロン
          </h1>
          <p className="text-gray-600 text-base leading-relaxed max-w-2xl">
            好きなテーマでつながる、Caratの会員専用サロンです。興味のあるカテゴリーを選んで、自由にサロン室を作成・参加できます。
          </p>
        </div>

        {/* Category Groups */}
        {grouped.map(group => (
          <section key={group.groupName} className="mb-10">
            <div className="flex items-center mb-4">
              <div className="w-1 h-6 bg-gray-800 rounded-full mr-3" />
              <h2 className="text-xl font-serif font-semibold text-gray-900">
                {group.groupName}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map(cat => (
                <Card
                  key={cat.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] border border-gray-200"
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{cat.icon || '📁'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-base font-bold text-gray-900 truncate">
                            {cat.display_name}
                          </h3>
                          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                          {cat.description}
                        </p>
                        <div className="text-xs text-gray-400">
                          サロン室 {cat.room_count}件
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default SalonPage;
