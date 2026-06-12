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

const MemberExchangeSection: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ageBand, setAgeBand] = useState('');
  const [prefecture, setPrefecture] = useState('');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_URL}/api/matching/search?page=1&size=9&_t=${Date.now()}`, { headers });
        if (res.ok) {
          const data = await res.json();
          const items: MemberItem[] = Array.isArray(data) ? data : data.items || [];
          setMembers(items.slice(0, 9));
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [token]);

  const filteredMembers = members.filter((m) => {
    if (ageBand && m.age_band !== ageBand) return false;
    if (prefecture && m.prefecture !== prefecture) return false;
    return true;
  });

  const displayMembers = filteredMembers.slice(0, 9);

  const ageBands = ['10代', '20代', '30代', '40代', '50代', '60代〜'];
  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県',
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
  ];

  return (
    <section className="py-10 md:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <select
            value={ageBand}
            onChange={(e) => setAgeBand(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">年代 ▼</option>
            {ageBands.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="">出身地 ▼</option>
            {prefectures.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {(ageBand || prefecture) && (
            <button
              onClick={() => { setAgeBand(''); setPrefecture(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              クリア
            </button>
          )}
        </div>

        {/* Member Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : displayMembers.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            {displayMembers.map((member) => (
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
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                      <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-2xl">👤</span>
                      </div>
                    </div>
                  )}
                  {/* Identity badge */}
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
        ) : (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            該当するメンバーがいません
          </div>
        )}

        {/* 全て見るボタン */}
        {displayMembers.length > 0 && (
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
