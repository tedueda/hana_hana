import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, ArrowLeft, MessageSquare, Users, Clock, ChevronLeft, ChevronRight, Search, LayoutGrid, List } from 'lucide-react';
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
  created_at?: string | null;
}

const SalonPage: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<SalonCategory[]>([]);
  const [rooms, setRooms] = useState<SalonRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryCreateError, setCategoryCreateError] = useState<string | null>(null);
  const [categoryCreateSuccess, setCategoryCreateSuccess] = useState<string | null>(null);
  const [roomSearchInput, setRoomSearchInput] = useState('');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [roomPage, setRoomPage] = useState(1);
  const [showRoomList, setShowRoomList] = useState(false);
  const [roomViewMode, setRoomViewMode] = useState<'card' | 'list'>('card');

  const categoriesRef = useRef<HTMLDivElement>(null);
  const roomsRef = useRef<HTMLDivElement>(null);

  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/salon/categories`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/api/salon/popular-rooms?limit=200`).then(r => r.ok ? r.json() : []),
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
  const handleShowRoomList = () => {
    setShowRoomList(true);
    setTimeout(() => roomsRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
  };
  const handleCreateCategory = () => requireAuth(async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryCreateError('カテゴリー名を入力してください。');
      setCategoryCreateSuccess(null);
      return;
    }
    setCreatingCategory(true);
    setCategoryCreateError(null);
    setCategoryCreateSuccess(null);
    try {
      const res = await fetch(`${API_URL}/api/salon/user-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ display_name: name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCategoryCreateError(data.detail || 'カテゴリーの作成に失敗しました。');
        return;
      }
      const created = await res.json();
      setCategories(prev => prev.some(cat => cat.id === created.id) ? prev : [...prev, { ...created, room_count: created.room_count ?? 0 }]);
      setNewCategoryName('');
      setCategoryCreateSuccess('カテゴリーを追加しました。');
      categoriesRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      setCategoryCreateError('ネットワークエラーが発生しました。');
    } finally {
      setCreatingCategory(false);
    }
  });
  const handleCategoryClick = (cat: SalonCategory) =>
    requireAuth(() => navigate(`/salon/create?category=${cat.id}`));
  const handleRoomClick = (roomId: number) =>
    requireAuth(() => navigate(`/salon/rooms/${roomId}`));
  const handleRoomSearch = () => {
    setShowRoomList(true);
    setRoomSearchQuery(roomSearchInput.trim());
    setRoomPage(1);
  };

  const filteredRooms = useMemo(() => {
    const query = roomSearchQuery.toLowerCase();
    return [...rooms]
      .sort((a, b) => {
        const aDate = new Date(a.created_at || a.last_post_at || 0).getTime();
        const bDate = new Date(b.created_at || b.last_post_at || 0).getTime();
        return bDate - aDate;
      })
      .filter(room => {
        if (!query) return true;
        return [room.theme, room.description, room.category_name]
          .filter(Boolean)
          .some(value => value!.toLowerCase().includes(query));
      });
  }, [rooms, roomSearchQuery]);

  const roomPageSize = 12;
  const roomPageCount = Math.max(1, Math.ceil(filteredRooms.length / roomPageSize));
  const paginatedRooms = filteredRooms.slice((roomPage - 1) * roomPageSize, roomPage * roomPageSize);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-5 py-8">

        {/* Back */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/feed')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </div>

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">会員サロン</h1>
          <div className="space-y-5 text-base text-gray-900 leading-relaxed">
            <p>あなた自身が常日頃感じていることや、社会に対して一緒に話題にしたい題材でサロンを作ってみませんか？</p>
            <p>自由にカテゴリーを作って、あなただけのテーマでサロンを立ち上げることができます。</p>
            <p>すでに用意されたカテゴリーから作ることも、既存のサロンに参加することもできます。</p>
          </div>
          <div className="mt-6 flex justify-center">
            <Button onClick={handleShowRoomList} className="w-full max-w-md bg-gray-950 hover:bg-black text-white rounded-md">
              既存のサロン一覧はこちら
            </Button>
          </div>
        </div>

        {/* 3 Pathway Cards */}
        <section className="mb-10 bg-gray-50 px-5 py-6 rounded-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6 text-center">サロンの作り方を選ぶ</h2>
          <div className="space-y-6">

            {/* 1: Free creation */}
            <div className="max-w-md mx-auto rounded-lg bg-white border border-gray-200 p-6 shadow-sm flex flex-col">
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
            <div className="max-w-md mx-auto rounded-lg bg-white border border-gray-200 p-6 shadow-sm flex flex-col">
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
            <div className="max-w-md mx-auto rounded-lg bg-white border border-gray-200 p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                <h3 className="text-base font-bold text-gray-900">新しいカテゴリーを作る</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-6">
                求めている内容がカテゴリー一覧にない場合は、皆さん自身が新たなカテゴリーを作成し、追加することができます。
              </p>
              <div className="space-y-3">
                <Input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="カテゴリー名を入力"
                  disabled={creatingCategory}
                />
                {categoryCreateError && <p className="text-xs text-red-600">{categoryCreateError}</p>}
                {categoryCreateSuccess && <p className="text-xs text-green-700">{categoryCreateSuccess}</p>}
                <Button onClick={handleCreateCategory} variant="outline" className="w-full" disabled={creatingCategory}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  {creatingCategory ? '作成中...' : 'カテゴリーを作成する'}
                </Button>
              </div>
            </div>

          </div>
        </section>

        {/* Categories section */}
        <section ref={categoriesRef} className="mb-10 bg-gray-50 px-5 py-6 rounded-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-2">カテゴリーからサロンを作る</h2>
          <p className="text-sm text-gray-500 mb-5">以下の興味のあるカテゴリーを選んで、サロンを作ることもできます。</p>
          {loading ? (
            <div className="text-sm text-gray-400">読み込み中...</div>
          ) : categories.length === 0 ? (
            <div className="text-sm text-gray-400">カテゴリーがまだ準備されていません。</div>
          ) : (
            <div className="flex flex-wrap gap-2 bg-white p-4 rounded-sm">
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
        {showRoomList && (
        <section ref={roomsRef} className="bg-gray-50 px-5 py-6 rounded-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-2">既存のサロンに参加する</h2>
          <p className="text-sm text-gray-500 mb-5">気になるサロンがあれば、まずは参加して会話をのぞいてみましょう。</p>
          <div className="mb-5 flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={roomSearchInput}
                  onChange={e => setRoomSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRoomSearch(); }}
                  placeholder="サロン名・説明・カテゴリーで検索"
                  className="pl-9"
                />
              </div>
              <Button onClick={handleRoomSearch} variant="outline" className="sm:w-28">
                検索
              </Button>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setRoomViewMode('card')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  roomViewMode === 'card' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                カード
              </button>
              <button
                type="button"
                onClick={() => setRoomViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  roomViewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                リスト
              </button>
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-gray-400">読み込み中...</div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-gray-200 text-gray-500 text-sm">
              該当するサロンがありません
            </div>
          ) : (
            <>
              {roomViewMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {paginatedRooms.map(room => (
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
              ) : (
                <div className="space-y-2">
                  {paginatedRooms.map(room => (
                    <div
                      key={room.id}
                      onClick={() => handleRoomClick(room.id)}
                      className="cursor-pointer bg-white rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 hover:border-gray-300 transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 min-w-0">
                            {room.category_name && (
                              <span className="inline-flex items-center text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                                {room.category_name}
                              </span>
                            )}
                            <h3 className="text-sm font-bold text-gray-900 truncate">{room.theme}</h3>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{room.description}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 md:flex-shrink-0">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {room.participant_count}人
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {room.post_count}件
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(room.last_post_at)}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs md:flex-shrink-0"
                          onClick={e => { e.stopPropagation(); handleRoomClick(room.id); }}
                        >
                          参加する
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-5 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRoomPage(prev => Math.max(1, prev - 1))}
                  disabled={roomPage <= 1}
                  className="px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-500">{roomPage} / {roomPageCount}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRoomPage(prev => Math.min(roomPageCount, prev + 1))}
                  disabled={roomPage >= roomPageCount}
                  className="px-3"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </section>
        )}

      </div>
    </div>
  );
};

export default SalonPage;
