import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { IdentityBadge } from '@/components/ui/IdentityBadge';

interface MemberItem {
  user_id: number;
  display_name?: string;
  identity?: string | null;
  prefecture?: string | null;
  age_band?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
}

// エスムラルダ(129)とTAKA(130)を常にトップに表示
const PINNED_USER_IDS = [129, 130];

const MemberExchangeSection: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // ページネーションで全メンバーを取得
        const allItems: MemberItem[] = [];
        let page = 1;
        const pageSize = 50;
        while (true) {
          const res = await fetch(
            `${API_URL}/api/matching/search?page=${page}&size=${pageSize}&show_all=true&_t=${Date.now()}`,
            { headers }
          );
          if (!res.ok) break;
          const data = await res.json();
          const items: MemberItem[] = Array.isArray(data) ? data : data.items || [];
          allItems.push(...items);
          if (items.length < pageSize) break;
          page++;
        }

        // ピン留めユーザーをトップに配置
        const pinned = allItems.filter(m => PINNED_USER_IDS.includes(m.user_id));
        const others = allItems.filter(m => !PINNED_USER_IDS.includes(m.user_id));
        // ピン留めの順番を維持
        pinned.sort((a, b) => PINNED_USER_IDS.indexOf(a.user_id) - PINNED_USER_IDS.indexOf(b.user_id));
        setMembers([...pinned, ...others]);
      } catch (err) {
        console.error('Failed to fetch members:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [token]);

  return (
    <section className="py-10 md:py-14">
      <div>
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-6 gap-2">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900">会員交流</h2>
            <p className="text-sm text-gray-500 mt-1">Caratに参加しているメンバーと気軽に交流できます</p>
          </div>
          <button
            onClick={() => navigate('/matching')}
            className="text-gray-600 hover:text-black font-medium text-sm flex items-center gap-1 self-start md:self-auto"
          >
            全て見る <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : members.length > 0 ? (
          <div
            className="overflow-y-auto"
            style={{ maxHeight: '900px' }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {members.map((member) => (
                <article
                  key={member.user_id}
                  onClick={() => navigate(`/matching/users/${member.user_id}`)}
                  className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md cursor-pointer"
                >
                  <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.display_name || ''}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                        <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center">
                          <span className="text-white text-2xl">👤</span>
                        </div>
                      </div>
                    )}
                    {member.identity && (
                      <div className="absolute top-2 left-2">
                        <IdentityBadge value={member.identity} />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {member.display_name || 'メンバー'}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {member.age_band && (
                        <span className="text-xs text-gray-500">{member.age_band}</span>
                      )}
                      {member.prefecture && (
                        <span className="text-xs text-gray-500 flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />{member.prefecture}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            該当するメンバーがいません
          </div>
        )}

        {members.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/matching')}
              className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              全て見る <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default MemberExchangeSection;
