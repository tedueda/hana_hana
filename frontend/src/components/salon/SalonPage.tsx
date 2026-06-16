import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Plus, ArrowLeft, MessageSquare, Users, Clock } from 'lucide-react';
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
  room_count: number;
}

interface SalonRoom {
  id: number;
  theme: string;
  description: string;
  category_name: string | null;
  post_count: number;
  participant_count: number;
  last_post_at: string | null;
}

const SalonPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<SalonCategory[]>([]);
  const [rooms, setRooms] = useState<SalonRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const categoriesRef = useRef<HTMLDivElement>(null);
  const roomsRef = useRef<HTMLDivElement>(null);

  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/salon/categories`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/api/salon/popular-rooms?limit=20`).then(r => r.ok ? r.json() : []),
    ]).then(([cats, rms]) => {
      setCategories(Array.isArray(cats) ? cats : []);
      setRooms(Array.isArray(rms) ? rms : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const requireAuth = (cb: () => void) => {
    if (!user) { navigate('/login'); return; }
    if (!isPaidUser) { navigate('/account'); return; }
    cb();
  };

  const handleCreateFree = () => requireAuth(() => navigate('/salon/create'));
  const handleCreateFromCategory = () => requireAuth(() =>
    categoriesRef.current?.scrollIntoView({ behavior: 'smooth' })
  );
  const handleJoinSalon = () => roomsRef.current?.scrollIntoView({ behavior: 'smooth' });
  const handleCategoryClick = (cat: SalonCategory) =>
    requireAuth(() => navigate(`/salon/create?category=${cat.id}`));
  const handleRoomClick = (roomId: number) =>
    requireAuth(() => navigate(`/salon/rooms/${roomId}`));

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Back */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/feed')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">会員サロン</h1>
          <h3 className="text-lg md:text-xl font-medium text-gray-700 mb-3 leading-relaxed max-w-3xl">
            あなた自身が常日頃感じていることや、社会に対して一緒に話題にしたい題材でサロンを作ってみませんか？
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            自由にカテゴリーを作って、あなただけのテーマでサロンを立ち上げることができます。<br className="hidden sm:block" />
            すでに用意されたカテゴリーから作ることも、既存のサロンに参加することもできます。
          </p>
        </div>

        {/* 3 Pathway Cards */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-gray-900 mb-6">サロンの作り方を選ぶ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* 1: Free creation */}
            <div className="rounded-2xl bg-white border border-gray-200 p-7 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                <h3 className="text-base font-bold text-gray-900">自由にサロンを作る</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-6">
                あなたの関心事や問題意識から、新しいカテゴリーとサロンテーマを自由に設定できます。まだないテーマでも、自分でサロンを立ち上げることができます。
              </p>
              <Button onClick={handleCreateFree} className="bg-gray-900 hover:bg-black text-white w-full">
                <Plus className="h-4 w-4 mr-1.5" />
                自由に作成する
              </Button>
            </div>

            {/* 2: From category */}
            <div className="rounded-2xl bg-white border border-gray-200 p-7 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                <h3 className="text-base font-bold text-gray-900">カテゴリーから作る</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-6">
                映画・音楽・グルメ・旅行・AIなど、用意されたカテゴリーを選んでサロンを作成できます。何から始めればよいか迷う方はこちらから始めてください。
              </p>
              <Button onClick={handleCreateFromCategory} variant="outline" className="w-full border-gray-300 text-gray-900 hover:bg-gray-50">
                カテゴリーから作る
              </Button>
            </div>

            {/* 3: Join existing */}
            <div className="rounded-2xl bg-white border border-gray-200 p-7 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                <h3 className="text-base font-bold text-gray-900">既存のサロンに参加する</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-6">
                すでに立ち上がっているサロンの中から、興味のあるテーマを探して参加できます。まずは気になるサロンをのぞいてみてください。
              </p>
              <Button onClick={handleJoinSalon} variant="outline" className="w-full">
                サロンを探す
              </Button>
            </div>

          </div>
        </section>

        {/* Categories section */}
        <section ref={categoriesRef} className="mb-14">
          <h2 className="text-xl font-bold text-gray-900 mb-2">カテゴリーからサロンを作る</h2>
          <p className="text-sm text-gray-500 mb-5">以下の興味のあるカテゴリーを選んで、サロンを作ることもできます。</p>
          {loading ? (
            <div className="text-sm text-gray-400">読み込み中...</div>
          ) : categories.length === 0 ? (
            <div className="text-sm text-gray-400">カテゴリーがまだ準備されていません。</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors cursor-pointer"
                >
                  {cat.icon && <span className="text-base leading-none">{cat.icon}</span>}
                  <span>{cat.display_name}</span>
                  {cat.room_count > 0 && (
                    <span className="text-xs opacity-60 ml-0.5">{cat.room_count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Existing rooms section */}
        <section ref={roomsRef}>
          <h2 className="text-xl font-bold text-gray-900 mb-2">既存のサロンに参加する</h2>
          <p className="text-sm text-gray-500 mb-5">気になるサロンがあれば、まずは参加して会話をのぞいてみましょう。</p>
          {loading ? (
            <div className="text-sm text-gray-400">読み込み中...</div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-gray-200 text-gray-500 text-sm">
              まだサロンがありません
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map(room => (
                <div
                  key={room.id}
                  onClick={() => handleRoomClick(room.id)}
                  className="cursor-pointer bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        {room.category_name && (
                          <span className="inline-flex items-center text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium flex-shrink-0">
                            {room.category_name}
                          </span>
                        )}
                        <h3 className="text-base font-bold text-gray-900 truncate">{room.theme}</h3>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{room.description}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          参加 {room.participant_count}人
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          投稿 {room.post_count}件
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          最終更新 {formatDate(room.last_post_at)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 text-xs"
                      onClick={e => { e.stopPropagation(); handleRoomClick(room.id); }}
                    >
                      参加する
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};

export default SalonPage;
