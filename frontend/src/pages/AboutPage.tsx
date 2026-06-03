import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
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

const MATCHING_PAGE_SIZE = 20;

function matchesIdentityFilter(item: MatchingCardItem, identity: IdentityFilter, userCategory?: string): boolean {
  if (identity === 'all') return true;
  const id = ((item as any).community_category || item.identity || '').trim();
  const idLower = id.toLowerCase();

  // 「おすすめ」タブ: ユーザー自身のカテゴリーに合致するものを表示
  if (identity === 'recommended') {
    if (!userCategory || userCategory === '非公開' || userCategory === '非表示') return true;
    const cat = userCategory.trim();
    // Match user's category
    if (cat === 'ゲイ' || cat.toLowerCase() === 'gay') return id === 'ゲイ' || idLower === 'gay';
    if (cat === 'レズビアン' || cat === 'レズ' || cat.toLowerCase() === 'lesbian') return id === 'レズビアン' || id === 'レズ' || idLower === 'lesbian';
    if (cat === 'バイセクシュアル' || cat === 'バイセクシャル' || cat === 'バイ' || cat.toLowerCase() === 'bisexual') return id === 'バイセクシュアル' || id === 'バイセクシャル' || id === 'バイ' || idLower === 'bisexual';
    if (cat === 'トランスジェンダー' || cat === 'トランス' || cat.toLowerCase() === 'transgender') return id === 'トランスジェンダー' || id === 'トランス' || idLower === 'transgender';
    if (cat === 'クィア' || cat === 'クエスチョニング' || cat.toLowerCase() === 'queer' || cat.toLowerCase() === 'questioning') return id === 'クィア' || id === 'クエスチョニング' || idLower === 'queer' || idLower === 'questioning';
    if (cat === 'ストレート・アライ') return id === 'ストレート・アライ' || id === 'その他' || idLower === 'other' || idLower === 'ally';
    return true; // Default show all
  }

  if (identity === 'gay') return id === 'ゲイ' || idLower === 'gay';
  if (identity === 'lesbian') return id === 'レズビアン' || id === 'レズ' || idLower === 'lesbian';
  if (identity === 'bisexual') return id === 'バイセクシュアル' || id === 'バイセクシャル' || id === 'バイ' || idLower === 'bisexual';
  if (identity === 'transgender') return id === 'トランスジェンダー' || id === 'トランス' || idLower === 'transgender';
  if (identity === 'queer') return id === 'クィア' || id === 'クエスチョニング' || idLower === 'queer' || idLower === 'questioning';
  if (identity === 'ally_other') return id === 'ストレート・アライ' || id === 'その他' || id === '男性' || id === '女性' || idLower === 'other' || idLower === 'ally' || idLower === 'male' || idLower === 'female';
  return true;
}

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

  // User community category (used for matching filter)
  const [userCommunityCategory, setUserCommunityCategory] = useState<string | null>(null);

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
      // Use userCommunityCategory (fetched from /api/matching/profiles/me) for "おすすめ" tab filtering
      const userCategory = userCommunityCategory || '';
      return matchesIdentityFilter(item, f.identity, userCategory);
    });
  }, [
    matchingItems,
    matchingFilters.nationality,
    matchingFilters.ageBand,
    matchingFilters.occupation,
    matchingFilters.meetPref,
    matchingFilters.identity,
    userCommunityCategory,
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

  // Fetch user's community category for "おすすめ" tab
  useEffect(() => {
    if (!token) return;
    const fetchUserCategory = async () => {
      try {
        const res = await resilientFetch('/api/matching/profiles/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUserCommunityCategory(data.community_category || data.identity || null);
        }
      } catch { /* ignore */ }
    };
    fetchUserCategory();
  }, [token]);

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
                  userCategory={userCommunityCategory}
                  onEditProfile={() => navigate('/matching/profile')}
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
                          条件検索の各項目を「すべて」に戻すか、別のカテゴリータブをお試しください。
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

          {/* Salon Tab - redirect to new /salon page */}
          {activeTab === 'salon' && (
            <SalonTabContent navigate={navigate} />
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
                      onClick={() => navigate(`/business?tab=${item.category}`)}
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
                  月会費770円（税込）でご利用いただけます。
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

      {/* CTA: 会員登録誘導 */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-16 md:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Caratに参加しませんか？
            </h2>
            <p className="text-gray-300 text-lg mb-3">
              月額770円（税込）で全機能をご利用いただけます
            </p>
            <p className="text-gray-400 text-sm mb-8">
              マッチング・会員サロン・ビジネス機能が使い放題。本人確認済みの安心なコミュニティです。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/subscribe"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-lg font-bold text-gray-900 hover:bg-gray-100 transition-colors shadow-lg"
              >
                会員登録する
              </Link>
              <Link
                to="/about/usage"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-500 px-8 py-4 text-lg font-medium text-white hover:bg-gray-700 transition-colors"
              >
                ご利用方法を見る
              </Link>
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
                プロフィール詳細の閲覧には有料会員登録（月額770円・税込）が必要です。
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

// ── Salon Tab: Category-based design ──

interface SalonCategoryItem {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  group_name: string;
  icon: string | null;
  room_count: number;
}

const SALON_GROUP_ORDER = [
  'エンタメ・カルチャー',
  'ライフスタイル',
  '社会・知識',
  '大人向け・ディープテーマ',
  'スポーツ',
];

const SalonTabContent: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const [categories, setCategories] = useState<SalonCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/salon/categories`);
        if (res.ok) setCategories(await res.json());
      } catch (err) {
        console.error('Failed to fetch salon categories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const grouped = SALON_GROUP_ORDER.map(groupName => ({
    groupName,
    items: categories.filter(c => c.group_name === groupName),
  })).filter(g => g.items.length > 0);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 mb-2">会員サロン</h2>
        <p className="text-gray-600">
          好きなテーマでつながる、Caratの会員専用サロンです。興味のあるカテゴリーを選んで、自由にサロン室を作成・参加できます。
        </p>
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={() => navigate('/salon/create')}
          className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + サロンを作成する
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.groupName} className="mb-8">
            <div className="flex items-center mb-3">
              <div className="w-1 h-5 bg-gray-800 rounded-full mr-3" />
              <h3 className="text-lg font-serif font-semibold text-gray-900">{group.groupName}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => navigate(`/salon/category/${cat.id}`)}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{cat.icon || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{cat.display_name}</h4>
                        <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-1">{cat.description}</p>
                      <span className="text-xs text-gray-400">サロン室 {cat.room_count}件</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default AboutPage;
