import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, MessageCircle, Users, Lock, Unlock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AboutTabs, { AboutTabType } from '../components/AboutTabs';
import MatchingFilter, {
  DEFAULT_MATCHING_FILTERS,
  type MatchingSearchFilters,
  type IdentityFilter,
} from '../components/MatchingFilter';
import MatchingCard, { MatchingCardItem } from '../components/MatchingCard';
import BusinessFilter, { BusinessCategory } from '../components/BusinessFilter';
import BusinessCard, { BusinessCardItem } from '../components/BusinessCard';
import { API_URL } from '../config';
import { useAuth, resilientFetch } from '../contexts/AuthContext';
import { usePaidMember } from '../hooks/usePremium';

interface SalonRoom {
  id: number;
  creator_id: number;
  theme: string;
  description: string;
  target_identities: string[];
  room_type: string;
  allow_anonymous: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  participant_count: number;
  creator_display_name: string | null;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  consultation: '相談',
  exchange: '交流',
  story: 'ストーリー',
  other: 'その他',
};

const MATCHING_PAGE_SIZE = 20;

function uniqSortedOptions(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = (v ?? '').trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ja'));
}

function matchesIdentityFilter(item: MatchingCardItem, identity: IdentityFilter): boolean {
  if (identity === 'all') return true;
  const id = (item.identity || '').trim();
  const idLower = id.toLowerCase();
  if (identity === 'lesbian') {
    return id === 'レズ' || id === 'レズビアン' || idLower === 'lesbian';
  }
  if (identity === 'gay') {
    return id === 'ゲイ' || idLower === 'gay';
  }
  return (
    id !== 'ゲイ' &&
    idLower !== 'gay' &&
    id !== 'レズ' &&
    id !== 'レズビアン' &&
    idLower !== 'lesbian'
  );
}

// Mock matching data for UI display
const MOCK_MATCHING_DATA: MatchingCardItem[] = [
  { user_id: 1, display_name: 'ユーザー A', identity: 'ゲイ', nationality: 'JP', prefecture: '東京都', age_band: '20代後半', occupation: '会社員', meet_pref: 'パートナー探し' },
  { user_id: 2, display_name: 'ユーザー B', identity: 'レズ', nationality: 'JP', prefecture: '大阪府', age_band: '30代前半', occupation: '自営業', meet_pref: '友人探し' },
  { user_id: 3, display_name: 'ユーザー C', identity: 'ゲイ', nationality: 'US', prefecture: '東京都', age_band: '20代前半', occupation: '学生', meet_pref: 'パートナー探し' },
  { user_id: 4, display_name: 'ユーザー D', identity: 'レズ', nationality: 'KR', prefecture: '福岡県', age_band: '30代後半', occupation: '会社員', meet_pref: '相談相手探し' },
  { user_id: 5, display_name: 'ユーザー E', identity: 'バイセクシュアル', nationality: 'JP', prefecture: '京都府', age_band: '20代後半', occupation: 'フリーランス', meet_pref: '友人探し' },
  { user_id: 6, display_name: 'ユーザー F', identity: 'ゲイ', nationality: 'JP', prefecture: '名古屋市', age_band: '40代前半', occupation: '医療関係', meet_pref: 'メンバー募集' },
  { user_id: 7, display_name: 'ユーザー G', identity: 'トランスジェンダー', nationality: 'TH', prefecture: '東京都', age_band: '20代後半', occupation: '会社員', meet_pref: 'パートナー探し' },
  { user_id: 8, display_name: 'ユーザー H', identity: 'レズ', nationality: 'JP', prefecture: '横浜市', age_band: '30代前半', occupation: '教育関係', meet_pref: '友人探し' },
];

const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { isPaidUser } = usePaidMember();

  // Tab state with URL preservation
  const initialTab = (searchParams.get('tab') as AboutTabType) || 'matching';
  const [activeTab, setActiveTab] = useState<AboutTabType>(initialTab);

  // Matching filter & list state
  const [matchingFilters, setMatchingFilters] = useState<MatchingSearchFilters>(DEFAULT_MATCHING_FILTERS);
  const [matchingItems, setMatchingItems] = useState<MatchingCardItem[]>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingPage, setMatchingPage] = useState(1);
  /** 1件も取得できなかったとき（HTTPエラー等）。DBが本当に0件のときは null のまま */
  const [matchingFetchError, setMatchingFetchError] = useState<string | null>(null);

  // Business filter state
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory>('all');
  const [businessItems, setBusinessItems] = useState<BusinessCardItem[]>([]);
  const [businessLoading, setBusinessLoading] = useState(false);

  // Salon state
  const [salonRooms, setSalonRooms] = useState<SalonRoom[]>([]);
  const [salonLoading, setSalonLoading] = useState(false);
  const [salonError, setSalonError] = useState<string | null>(null);
  const [salonRoomType, setSalonRoomType] = useState<string | null>(null);

  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Premium upgrade modal state (logged in but not paid)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleTabChange = (tab: AboutTabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Fetch matching data（有料会員は複数ページを結合して最大取得）
  useEffect(() => {
    if (activeTab !== 'matching') return;

    let cancelled = false;

    const loadMatching = async () => {
      setMatchingLoading(true);
      try {
        const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const merged: MatchingCardItem[] = [];
        let page = 1;
        const size = 50;
        let receivedSuccessfulPage = false;

        // 有料会員は /search（自分除外付き）、それ以外は /public-preview を使用
        const endpoint = isPaidUser ? '/api/matching/search' : '/api/matching/public-preview';

        while (page <= 10 && !cancelled) {
          const res = await resilientFetch(
            `${endpoint}?page=${page}&size=${size}&_t=${Date.now()}`,
            { headers },
          );
          if (!res.ok) {
            if (!cancelled) {
              setMatchingFetchError(
                !receivedSuccessfulPage
                  ? `サーバーから応答がありません（HTTP ${res.status}）。バックエンドに ${endpoint} がデプロイされているか確認してください。`
                  : null,
              );
            }
            break;
          }

          const data = await res.json();
          const items: MatchingCardItem[] = Array.isArray(data) ? data : data.items || [];
          receivedSuccessfulPage = true;
          merged.push(...items);

          const total = typeof data.count === 'number' ? data.count : merged.length;
          if (items.length < size || merged.length >= total) break;
          page += 1;
        }

        if (!cancelled) {
          if (receivedSuccessfulPage) {
            setMatchingFetchError(null);
          }
          // 本番DBの結果をそのまま表示（0件のときはモックに差し替えない）
          setMatchingItems(merged);
        }
      } catch {
        if (!cancelled) {
          setMatchingFetchError(
            'バックエンドに接続できませんでした。ネットワークまたは CORS 設定を確認してください。',
          );
          setMatchingItems([]);
        }
      } finally {
        if (!cancelled) setMatchingLoading(false);
      }
    };

    loadMatching();
    return () => {
      cancelled = true;
    };
  }, [activeTab, token, isPaidUser]);

  // 条件変更時は1ページ目へ
  useEffect(() => {
    setMatchingPage(1);
  }, [
    matchingFilters.nationality,
    matchingFilters.ageBand,
    matchingFilters.occupation,
    matchingFilters.meetPref,
    matchingFilters.identity,
  ]);

  // Fetch salon rooms (public endpoint)
  useEffect(() => {
    if (activeTab !== 'salon') return;

    let cancelled = false;

    const loadSalonRooms = async () => {
      setSalonLoading(true);
      setSalonError(null);
      try {
        const params = new URLSearchParams({ page: '1', size: '50' });
        if (salonRoomType) params.append('room_type', salonRoomType);

        const res = await resilientFetch(
          `/api/salon/public-rooms?${params}`,
          { headers: { 'Cache-Control': 'no-cache' } },
        );
        if (!res.ok) {
          if (!cancelled) {
            setSalonError(`サーバーから応答がありません（HTTP ${res.status}）`);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setSalonRooms(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setSalonError('サロンの取得に失敗しました。');
          setSalonRooms([]);
        }
      } finally {
        if (!cancelled) setSalonLoading(false);
      }
    };

    loadSalonRooms();
    return () => { cancelled = true; };
  }, [activeTab, salonRoomType]);

  // Fetch business data
  useEffect(() => {
    const fetchBusiness = async () => {
      setBusinessLoading(true);
      const allItems: BusinessCardItem[] = [];

      try {
        // Fetch flea market items
        if (businessCategory === 'all' || businessCategory === 'flea-market') {
          try {
            const res = await fetch(`${API_URL}/api/flea-market/items?status=active`);
            if (res.ok) {
              const data = await res.json();
              const items = Array.isArray(data) ? data : (data.items || []);
              allItems.push(...items.map((item: BusinessCardItem) => ({ ...item, category: 'flea-market' })));
            }
          } catch { /* ignore */ }
        }

        // Fetch art sales items
        if (businessCategory === 'all' || businessCategory === 'art-sales') {
          try {
            const res = await fetch(`${API_URL}/api/art-sales/items`);
            if (res.ok) {
              const data = await res.json();
              const items = Array.isArray(data) ? data : [];
              allItems.push(...items.map((item: BusinessCardItem) => ({ ...item, category: 'art-sales' })));
            }
          } catch { /* ignore */ }
        }

        // Fetch courses
        if (businessCategory === 'all' || businessCategory === 'courses') {
          try {
            const res = await fetch(`${API_URL}/api/courses`);
            if (res.ok) {
              const data = await res.json();
              const items = Array.isArray(data) ? data : [];
              allItems.push(...items.map((item: BusinessCardItem) => ({ ...item, category: 'courses' })));
            }
          } catch { /* ignore */ }
        }

        setBusinessItems(allItems);
      } catch {
        setBusinessItems([]);
      } finally {
        setBusinessLoading(false);
      }
    };
    if (activeTab === 'business') {
      fetchBusiness();
    }
  }, [activeTab, businessCategory]);

// 固定のフィルターオプション（以前の設定を忠実に再現）
const FIXED_FILTER_OPTIONS = {
  nationalities: ['日本', 'アメリカ', '韓国', '中国', '台湾', '香港', 'タイ', 'ベトナム', 'フィリピン', 'インドネシア', 'マレーシア', 'シンガポール', 'インド', 'オーストラリア', 'ニュージーランド', 'イギリス', 'ドイツ', 'フランス', 'イタリア', 'スペイン', 'ポルトガル', 'オランダ', 'ベルギー', 'スイス', 'スウェーデン', 'ノルウェー', 'デンマーク', 'フィンランド', 'ロシア', 'カナダ', 'メキシコ', 'ブラジル', 'アルゼンチン', 'チリ', 'コロンビア', 'ペルー', 'その他'],
  ageBands: ['10代', '20代前半', '20代後半', '30代前半', '30代後半', '40代前半', '40代後半', '50代前半', '50代後半', '60代以上'],
  occupations: ['会社員', '自営業', 'フリーランス', '学生', '専門職', '公務員', 'パート・アルバイト', 'その他'],
  meetPrefs: ['パートナー探し', '友人探し', '相談相手探し', 'メンバー募集', 'その他'],
};

  const matchingFilterOptions = useMemo(
    () => ({
      nationalities: FIXED_FILTER_OPTIONS.nationalities,
      ageBands: FIXED_FILTER_OPTIONS.ageBands,
      occupations: FIXED_FILTER_OPTIONS.occupations,
      meetPrefs: FIXED_FILTER_OPTIONS.meetPrefs,
    }),
    [],
  );

  const filteredMatchingItems = useMemo(() => {
    const f = matchingFilters;
    return matchingItems.filter((item) => {
      if (f.nationality && (item.nationality || '') !== f.nationality) return false;
      if (f.ageBand && (item.age_band || '') !== f.ageBand) return false;
      if (f.occupation && (item.occupation || '') !== f.occupation) return false;
      if (f.meetPref && (item.meet_pref || '') !== f.meetPref) return false;
      return matchesIdentityFilter(item, f.identity);
    });
  }, [
    matchingItems,
    matchingFilters.nationality,
    matchingFilters.ageBand,
    matchingFilters.occupation,
    matchingFilters.meetPref,
    matchingFilters.identity,
  ]);

  const matchingTotalPages = Math.max(1, Math.ceil(filteredMatchingItems.length / MATCHING_PAGE_SIZE));

  useEffect(() => {
    setMatchingPage((p) => Math.min(p, matchingTotalPages));
  }, [matchingTotalPages]);

  const safeMatchingPage = Math.min(matchingPage, matchingTotalPages);
  const paginatedMatchingItems = filteredMatchingItems.slice(
    (safeMatchingPage - 1) * MATCHING_PAGE_SIZE,
    safeMatchingPage * MATCHING_PAGE_SIZE,
  );

  const handleMatchingCardClick = (userId: number) => {
    if (!user) {
      setShowLoginModal(true);
    } else if (!isPaidUser) {
      setShowUpgradeModal(true);
    } else {
      navigate(`/matching/users/${userId}`);
    }
  };

  const handleSalonRoomClick = (roomId: number) => {
    if (!user) {
      setShowLoginModal(true);
    } else if (!isPaidUser) {
      setShowUpgradeModal(true);
    } else {
      navigate(`/salon/rooms/${roomId}`);
    }
  };

  const salonRoomTypes = [
    { value: null, label: 'すべて' },
    { value: 'consultation', label: '相談' },
    { value: 'exchange', label: '交流' },
    { value: 'story', label: 'ストーリー' },
    { value: 'other', label: 'その他' },
  ];

  return (
    <div className="bg-white">
      {/* Tabs */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 pt-8 md:pt-10">
        <AboutTabs activeTab={activeTab} onTabChange={handleTabChange} />
      </section>

      {/* Tab Content */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Matching Tab */}
          {activeTab === 'matching' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">会員マッチング</h2>
                <p className="text-gray-600">出会い・友達・恋人 - 理想のパートナーと安心して出会えます</p>
              </div>

              <div className="mb-6">
                <MatchingFilter
                  value={matchingFilters}
                  onChange={setMatchingFilters}
                  options={matchingFilterOptions}
                />
              </div>

              {matchingFetchError && (
                <div
                  className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  role="alert"
                >
                  {matchingFetchError}
                </div>
              )}

              {matchingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredMatchingItems.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {paginatedMatchingItems.map((item) => (
                      <MatchingCard
                        key={item.user_id}
                        item={item}
                        blurred={!isPaidUser}
                        onClick={() => handleMatchingCardClick(item.user_id)}
                      />
                    ))}
                  </div>
                  {matchingTotalPages > 1 && (
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                      <span className="text-sm text-gray-600">
                        {safeMatchingPage} / {matchingTotalPages} ページ（全 {filteredMatchingItems.length} 件）
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={safeMatchingPage <= 1}
                          onClick={() => setMatchingPage((p) => Math.max(1, p - 1))}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          前へ
                        </button>
                        <button
                          type="button"
                          disabled={safeMatchingPage >= matchingTotalPages}
                          onClick={() => setMatchingPage((p) => p + 1)}
                          className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          次へ
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : matchingFetchError ? null : (
                <div className="flex min-h-[300px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white">
                  <div className="text-center px-4">
                    {matchingItems.length === 0 ? (
                      <>
                        <p className="text-lg font-medium text-gray-600">
                          掲載中のプロフィールがまだありません
                        </p>
                        <p className="mt-2 text-sm text-gray-500">
                          API とは接続できています。本番 DB で matching_profiles の display_flag（掲載）が ON
                          のユーザーがいるか確認してください。
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium text-gray-600">ユーザーが見つかりません</p>
                        <p className="mt-2 text-sm text-gray-500">
                          条件検索の各項目を「すべて」に戻すか、別の性自認タブに相当する条件をお試しください。
                        </p>
                        <button
                          type="button"
                          onClick={() => setMatchingFilters(DEFAULT_MATCHING_FILTERS)}
                          className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                        >
                          条件をリセット
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Salon Tab */}
          {activeTab === 'salon' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">会員サロン</h2>
                <p className="text-gray-600">安心して交流できる場所 - テーマ別のチャットルームで自由に交流できます</p>
              </div>

              {/* Room type filter */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                {salonRoomTypes.map((type) => (
                  <button
                    key={type.value || 'all'}
                    type="button"
                    onClick={() => setSalonRoomType(type.value)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      salonRoomType === type.value
                        ? 'bg-gray-900 text-white'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {salonError && (
                <div
                  className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  role="alert"
                >
                  {salonError}
                </div>
              )}

              {salonLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : salonRooms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {salonRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => handleSalonRoomClick(room.id)}
                      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
                        </span>
                        <div className="flex items-center gap-1 text-gray-500">
                          {room.allow_anonymous ? (
                            <Unlock className="h-4 w-4" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                        </div>
                      </div>

                      <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-gray-700">
                        {room.theme}
                      </h3>

                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                        {room.description}
                      </p>

                      <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {room.participant_count}人
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                          </span>
                        </div>
                        <span className="text-xs">
                          {new Date(room.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {room.creator_display_name && (
                        <div className="mt-2 text-xs text-gray-400">
                          作成者: {room.creator_display_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : salonError ? null : (
                <div className="flex min-h-[300px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white">
                  <div className="text-center px-4">
                    <MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-600">サロンルームがまだありません</p>
                    <p className="mt-2 text-sm text-gray-500">
                      最初のサロンルームを作成してみましょう
                    </p>
                  </div>
                </div>
              )}

              {/* Non-auth info banner */}
              {!user && salonRooms.length > 0 && (
                <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  サロンに参加するにはログインまたは会員登録が必要です。ルームをクリックしてログインしてください。
                </div>
              )}
            </div>
          )}

          {/* Business Tab */}
          {activeTab === 'business' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">ビジネス</h2>
                <p className="text-gray-600 mb-1">フリマ・作品販売・講座</p>
                <p className="text-sm text-gray-500">
                  手数料はかかりません。ユーザー同士で販売ができます。<br />
                  ※非会員の方も購入可能
                </p>
              </div>

              <div className="mb-6">
                <BusinessFilter activeCategory={businessCategory} onCategoryChange={setBusinessCategory} />
              </div>

              {businessLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : businessItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {businessItems.map((item) => (
                    <BusinessCard
                      key={`${item.category}-${item.id}`}
                      item={item}
                      type={item.category as 'flea-market' | 'art-sales' | 'courses'}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[300px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white">
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-600">投稿がありません</p>
                    <p className="mt-2 text-sm text-gray-500">現在表示できる投稿がありません</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Safety section */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
          <div className="max-w-5xl mx-auto mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-6">
              カラットとは
            </h2>
            <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-8 md:p-10">
              <div className="text-gray-800 leading-relaxed">
                <p>Caratは</p>
                <p className="mt-1">・マッチング</p>
                <p>・会員サロン</p>
                <p>・ビジネス</p>
                <p className="mt-4 text-gray-700">
                  の3つの機能で構成された会員制LGBTQ+コミュニティです。
                </p>
                <p className="mt-4 text-gray-700">
                  月会費1000円（税込）でご利用いただけます。
                </p>
                <p className="mt-4 text-gray-700">ビジネス機能は手数料不要です。</p>
                <p className="mt-1 text-gray-700">会員同士で直接やり取りしてください。</p>
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{t('about.safety.title')}</h2>
            </div>

            <p className="mt-4 text-gray-700 leading-relaxed">
              {t('about.safety.body')}
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900">{t('about.safety.cards.kyc.title')}</h3>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                  {t('about.safety.cards.kyc.body')}
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900">{t('about.safety.cards.moderation.title')}</h3>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                  {t('about.safety.cards.moderation.body')}
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900">{t('about.safety.cards.security.title')}</h3>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                  {t('about.safety.cards.security.body')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Carat description */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-8 md:p-10">
            <p className="text-gray-900 text-lg md:text-xl font-semibold leading-relaxed mb-4">
              Caratは、マッチング・会員サロン・ビジネスの3つの機能で構成された会員制LGBTQ+コミュニティです。
            </p>
            <p className="text-gray-700 leading-relaxed mb-6">
              {t('about.closingQuote')}
            </p>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-gray-600">
                <div className="font-semibold text-gray-900">{t('about.operatorLabel')}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/subscribe"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  {t('about.cta.plans')}
                </Link>
                <Link
                  to="/about/usage"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  ご利用方法を見る
                </Link>
                <Link
                  to="/feed"
                  className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
                >
                  {t('about.cta.getStarted')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Login Modal (未ログイン) */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="h-12 w-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">この機能は会員限定です</h3>
              <p className="text-gray-600 mb-6 text-sm">
                ご利用にはログインまたは会員登録が必要です。
              </p>
              <div className="flex gap-2">
                <Link
                  to="/login"
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-center text-sm font-medium"
                >
                  ログイン
                </Link>
                <Link
                  to="/subscribe"
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center text-sm font-medium"
                >
                  会員登録
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal (ログイン済み・非有料会員) */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="h-12 w-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">この機能は有料会員専用です</h3>
              <p className="text-gray-600 mb-6 text-sm">
                プロフィール詳細の閲覧には有料会員登録（月額1,000円・税込）が必要です。
              </p>
              <div className="flex gap-2">
                <Link
                  to="/subscribe"
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-center text-sm font-medium"
                >
                  会員登録
                </Link>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center text-sm font-medium"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutPage;
