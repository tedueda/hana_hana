import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ChevronUp, ChevronDown, MessageSquare, Users, ArrowRight } from 'lucide-react';
import { API_URL } from '../../config';

interface PopularRoom {
  id: number;
  theme: string;
  description: string;
  category_name: string | null;
  post_count: number;
  participant_count: number;
  last_post_at: string | null;
  target_audiences: string[] | null;
  thumbnail_url: string | null;
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
};

const getAudienceBadges = (audiences: string[] | null) => {
  if (!audiences || audiences.length === 0 || audiences.includes('全員')) return null;
  return audiences.map(a => AUDIENCE_BADGE_MAP[a] || a.charAt(0)).filter(Boolean);
};

const PopularSalons: React.FC = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<PopularRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const res = await fetch(`${API_URL}/api/salon/popular-rooms?limit=10`);
        if (res.ok) setRooms(await res.json());
      } catch (err) {
        console.error('Failed to fetch popular salons:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPopular();
  }, []);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };

  useEffect(() => {
    updateScrollState();
  }, [rooms]);

  const scroll = (direction: 'up' | 'down') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === 'up' ? -160 : 160;
    el.scrollBy({ top: amount, behavior: 'smooth' });
    setTimeout(updateScrollState, 300);
  };

  if (loading) return null;

  // Empty state
  if (rooms.length === 0) {
    return (
      <section className="py-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            <h2 className="text-xl font-serif font-bold text-gray-900 mb-2">会員サロン</h2>
            <p className="text-gray-500 text-sm mb-4">
              会員サロンはまだありません。<br />
              最初のサロンを作成して、Caratの交流を始めましょう。
            </p>
            <Button onClick={() => navigate('/salon/create')} className="bg-black hover:bg-gray-800 text-white">
              サロンを作成する
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10">
      <div className="max-w-5xl mx-auto px-4">
        <div
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          style={{
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            borderColor: 'rgba(212, 175, 55, 0.3)',
          }}
        >
          <div className="flex flex-col md:flex-row">
            {/* Left: heading + CTA */}
            <div className="p-6 md:p-8 md:w-[300px] flex-shrink-0 flex flex-col justify-center">
              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-3">会員サロン</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                投稿が多く盛り上がっているサロンをチェックできます。
                興味のあるテーマから、Caratの交流に参加してみましょう。
              </p>
              <Button
                onClick={() => navigate('/salon')}
                className="bg-black hover:bg-gray-800 text-white w-full md:w-auto"
              >
                サロン一覧を見る
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            {/* Right: scrollable card list (PC) / horizontal scroll (mobile) */}
            <div className="flex-1 relative border-t md:border-t-0 md:border-l border-gray-100">
              {/* PC: vertical scroll */}
              <div className="hidden md:block relative">
                <div
                  ref={scrollRef}
                  onScroll={updateScrollState}
                  className="overflow-y-auto max-h-[400px] p-4 space-y-3 scrollbar-thin"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {rooms.map(room => {
                    const badges = getAudienceBadges(room.target_audiences);
                    return (
                      <Card
                        key={room.id}
                        className="cursor-pointer transition-all hover:shadow-md border border-gray-100"
                        onClick={() => navigate(`/salon/rooms/${room.id}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <h3 className="text-sm font-bold text-gray-900 truncate">{room.theme}</h3>
                                {badges && badges.map(badge => (
                                  <span key={badge} className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-0.5 text-[9px] font-bold bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full flex-shrink-0">{badge}</span>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1.5">
                                {room.category_name && <span>{room.category_name}</span>}
                                <span className="flex items-center gap-0.5">
                                  <MessageSquare className="h-3 w-3" />
                                  {room.post_count}件
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Users className="h-3 w-3" />
                                  {room.participant_count}人
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-2">{room.description}</p>
                            </div>
                            {room.thumbnail_url && (
                              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                                <img src={room.thumbnail_url} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {/* Scroll buttons */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                  <button
                    onClick={() => scroll('up')}
                    disabled={!canScrollUp}
                    className={`w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm transition-opacity ${
                      canScrollUp ? 'opacity-100 hover:bg-gray-50' : 'opacity-30 cursor-not-allowed'
                    }`}
                  >
                    <ChevronUp className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => scroll('down')}
                    disabled={!canScrollDown}
                    className={`w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm transition-opacity ${
                      canScrollDown ? 'opacity-100 hover:bg-gray-50' : 'opacity-30 cursor-not-allowed'
                    }`}
                  >
                    <ChevronDown className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Mobile: horizontal scroll */}
              <div className="md:hidden overflow-x-auto p-4 flex gap-3 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                {rooms.map(room => {
                  const badges = getAudienceBadges(room.target_audiences);
                  return (
                    <Card
                      key={room.id}
                      className="cursor-pointer flex-shrink-0 w-[260px] snap-start transition-all hover:shadow-md border border-gray-100"
                      onClick={() => navigate(`/salon/rooms/${room.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <h3 className="text-sm font-bold text-gray-900 truncate">{room.theme}</h3>
                              {badges && badges.map(badge => (
                                <span key={badge} className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-0.5 text-[9px] font-bold bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full flex-shrink-0">{badge}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1.5">
                              {room.category_name && <span>{room.category_name}</span>}
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="h-3 w-3" />
                                {room.post_count}件
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Users className="h-3 w-3" />
                                {room.participant_count}人
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2">{room.description}</p>
                          </div>
                          {room.thumbnail_url && (
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                              <img src={room.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="mt-2 text-xs w-full">見る</Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PopularSalons;
