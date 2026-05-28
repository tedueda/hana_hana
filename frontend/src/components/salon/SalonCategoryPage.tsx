import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ArrowLeft, Plus, MessageSquare, Users, Clock, AlertTriangle } from 'lucide-react';
import { API_URL } from '../../config';

interface SalonCategory {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  group_name: string;
  icon: string | null;
  warning_text: string | null;
  room_count: number;
}

interface SalonRoomItem {
  id: number;
  category_id: number | null;
  category_name: string | null;
  theme: string;
  description: string;
  tags: string[];
  visibility: string;
  target_audiences: string[] | null;
  thumbnail_url: string | null;
  participant_count: number;
  post_count: number;
  creator_display_name: string | null;
  created_at: string;
  last_post_at: string | null;
}

const AUDIENCE_BADGE_MAP: Record<string, string> = {
  'ゲイ': 'G',
  'レズビアン': 'L',
  'バイセクシュアル': 'B',
  'トランスジェンダー': 'T',
  'ノンバイナリー': 'NB',
  'クエスチョニング': 'Q',
  'アライ': 'A',
  'その他': '他',
  '全員': 'ALL',
};

const SalonCategoryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const [category, setCategory] = useState<SalonCategory | null>(null);
  const [rooms, setRooms] = useState<SalonRoomItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  useEffect(() => {
    const load = async () => {
      if (!categoryId) return;
      setLoading(true);
      try {
        const [catRes, roomsRes] = await Promise.all([
          fetch(`${API_URL}/api/salon/categories/${categoryId}`),
          fetch(`${API_URL}/api/salon/categories/${categoryId}/rooms?size=50`),
        ]);
        if (catRes.ok) setCategory(await catRes.json());
        if (roomsRes.ok) setRooms(await roomsRes.json());
      } catch (err) {
        console.error('Failed to load category:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [categoryId]);

  const handleRoomClick = (roomId: number) => {
    if (!user) { navigate('/login'); return; }
    if (!isPaidUser) { navigate('/account'); return; }
    navigate(`/salon/rooms/${roomId}`);
  };

  const handleCreateRoom = () => {
    if (!user) { navigate('/login'); return; }
    if (!isPaidUser) { navigate('/account'); return; }
    navigate(`/salon/create?category=${categoryId}`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
  };

  const getAudienceBadges = (audiences: string[] | null) => {
    if (!audiences || audiences.length === 0 || audiences.includes('全員')) return null;
    return audiences.map(a => AUDIENCE_BADGE_MAP[a] || a.charAt(0)).filter(Boolean);
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
            onClick={() => navigate('/salon')}
            className="text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            サロン一覧へ
          </Button>
          <Button onClick={handleCreateRoom} className="bg-black hover:bg-gray-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            サロン室を作成
          </Button>
        </div>

        {/* Category Header */}
        {category && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{category.icon || '📁'}</span>
              <h1 className="text-3xl font-serif font-bold text-gray-900">
                {category.display_name}
              </h1>
            </div>
            <p className="text-gray-600 mb-1">{category.description}</p>
            <p className="text-sm text-gray-400">{category.group_name} ・ サロン室 {rooms.length}件</p>

            {/* Warning text for sensitive categories */}
            {category.warning_text && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{category.warning_text}</p>
              </div>
            )}
          </div>
        )}

        {/* Room list */}
        {rooms.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 mb-4">まだサロン室がありません。</p>
            <p className="text-gray-400 text-sm mb-6">最初のサロン室を作成して、交流を始めましょう。</p>
            <Button onClick={handleCreateRoom} className="bg-black hover:bg-gray-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              サロン室を作成する
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map(room => {
              const badges = getAudienceBadges(room.target_audiences);
              return (
                <Card
                  key={room.id}
                  className="cursor-pointer transition-all hover:shadow-md border border-gray-200"
                  onClick={() => handleRoomClick(room.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-gray-900 truncate">{room.theme}</h3>
                          {badges && badges.length > 0 && (
                            <div className="flex gap-1 flex-shrink-0">
                              {badges.map(badge => (
                                <span
                                  key={badge}
                                  className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 text-[10px] font-bold bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{room.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            投稿 {room.post_count}件
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            参加 {room.participant_count}人
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            最終投稿 {formatDate(room.last_post_at)}
                          </span>
                          {room.creator_display_name && (
                            <span>作成者: {room.creator_display_name}</span>
                          )}
                        </div>
                        {room.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {room.tags.map(tag => (
                              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Thumbnail + Action */}
                      <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        {room.thumbnail_url && (
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                            <img src={room.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <Button variant="outline" size="sm" className="text-xs">
                          見る
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalonCategoryPage;
