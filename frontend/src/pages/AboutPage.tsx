import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import aboutHero from '../assets/images/hero4.png';
import AboutTabs, { AboutTabType } from '../components/AboutTabs';
import MatchingFilter, { MatchingCategory } from '../components/MatchingFilter';
import MatchingCard, { MatchingCardItem } from '../components/MatchingCard';
import BusinessFilter, { BusinessCategory } from '../components/BusinessFilter';
import BusinessCard, { BusinessCardItem } from '../components/BusinessCard';
import { API_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';

// Mock matching data for UI display
const MOCK_MATCHING_DATA: MatchingCardItem[] = [
  { user_id: 1, display_name: 'ユーザー A', identity: 'ゲイ', nationality: 'JP', prefecture: '東京都', age_band: '20代後半', meet_pref: 'パートナー探し' },
  { user_id: 2, display_name: 'ユーザー B', identity: 'レズ', nationality: 'JP', prefecture: '大阪府', age_band: '30代前半', meet_pref: '友人探し' },
  { user_id: 3, display_name: 'ユーザー C', identity: 'ゲイ', nationality: 'US', prefecture: '東京都', age_band: '20代前半', meet_pref: 'パートナー探し' },
  { user_id: 4, display_name: 'ユーザー D', identity: 'レズ', nationality: 'KR', prefecture: '福岡県', age_band: '30代後半', meet_pref: '相談相手探し' },
  { user_id: 5, display_name: 'ユーザー E', identity: 'バイセクシュアル', nationality: 'JP', prefecture: '京都府', age_band: '20代後半', meet_pref: '友人探し' },
  { user_id: 6, display_name: 'ユーザー F', identity: 'ゲイ', nationality: 'JP', prefecture: '名古屋市', age_band: '40代前半', meet_pref: 'メンバー募集' },
  { user_id: 7, display_name: 'ユーザー G', identity: 'トランスジェンダー', nationality: 'TH', prefecture: '東京都', age_band: '20代後半', meet_pref: 'パートナー探し' },
  { user_id: 8, display_name: 'ユーザー H', identity: 'レズ', nationality: 'JP', prefecture: '横浜市', age_band: '30代前半', meet_pref: '友人探し' },
];

const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Tab state with URL preservation
  const initialTab = (searchParams.get('tab') as AboutTabType) || 'matching';
  const [activeTab, setActiveTab] = useState<AboutTabType>(initialTab);

  // Matching filter state
  const [matchingCategory, setMatchingCategory] = useState<MatchingCategory>('all');
  const [matchingItems, setMatchingItems] = useState<MatchingCardItem[]>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Business filter state
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory>('all');
  const [businessItems, setBusinessItems] = useState<BusinessCardItem[]>([]);
  const [businessLoading, setBusinessLoading] = useState(false);

  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleTabChange = (tab: AboutTabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Fetch matching data
  useEffect(() => {
    const fetchMatching = async () => {
      setMatchingLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/matching/search?page=1&size=50&_t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const data = await res.json();
          const items: MatchingCardItem[] = Array.isArray(data) ? data : (data.items || []);
          if (items.length > 0) {
            setMatchingItems(items);
          } else {
            setMatchingItems(MOCK_MATCHING_DATA);
          }
        } else {
          setMatchingItems(MOCK_MATCHING_DATA);
        }
      } catch {
        setMatchingItems(MOCK_MATCHING_DATA);
      } finally {
        setMatchingLoading(false);
      }
    };
    if (activeTab === 'matching') {
      fetchMatching();
    }
  }, [activeTab]);

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

  // Filter matching items by category
  const filteredMatchingItems = matchingItems.filter((item) => {
    if (matchingCategory === 'all') return true;
    if (matchingCategory === 'lesbian') {
      return item.identity === 'レズ' || item.identity === 'レズビアン' || item.identity === 'lesbian';
    }
    if (matchingCategory === 'gay') {
      return item.identity === 'ゲイ' || item.identity === 'gay';
    }
    // 'other'
    return item.identity !== 'ゲイ' && item.identity !== 'gay' && item.identity !== 'レズ' && item.identity !== 'レズビアン' && item.identity !== 'lesbian';
  });

  const handleMatchingCardClick = () => {
    if (!user) {
      setShowLoginModal(true);
    }
  };

  return (
    <div className="bg-white">
      {/* Hero section */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 pt-8 md:pt-12">
        <div className="max-w-5xl mx-auto overflow-hidden rounded-2xl">
          <img
            src={aboutHero}
            alt="Carat about hero"
            className="w-full h-48 sm:h-64 md:h-80 lg:h-96 object-cover"
          />
        </div>
      </section>

      {/* Tabs */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 pt-8">
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
                <MatchingFilter activeCategory={matchingCategory} onCategoryChange={setMatchingCategory} />
              </div>

              {matchingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : filteredMatchingItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredMatchingItems.map((item) => (
                    <MatchingCard
                      key={item.user_id}
                      item={item}
                      blurred={true}
                      onClick={handleMatchingCardClick}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[300px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white">
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-600">ユーザーが見つかりません</p>
                    <p className="mt-2 text-sm text-gray-500">他のカテゴリーをお試しください</p>
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
                <p className="text-gray-600">安心して交流できる場所 - 有料会員限定のコミュニティ</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
                <div className="text-5xl mb-4">💬</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">会員サロンは有料会員専用です</h3>
                <p className="text-gray-600 mb-6">
                  会員登録をすると、安心して交流できるサロン機能をご利用いただけます。
                </p>
                <Link
                  to="/subscribe"
                  className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black transition-colors"
                >
                  会員登録はこちら
                </Link>
              </div>
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

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="h-12 w-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">このプロフィールの詳細閲覧は会員限定です</h3>
              <p className="text-gray-600 mb-6 text-sm">
                詳細を確認するにはログインまたは会員登録が必要です。
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
    </div>
  );
};

export default AboutPage;
