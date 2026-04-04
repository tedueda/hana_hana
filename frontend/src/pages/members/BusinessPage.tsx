import React, { useState } from 'react';
import { ArrowLeft, ShoppingBag, Palette, GraduationCap } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FleaMarketList from '../../components/flea-market/FleaMarketList';
import ArtSaleList from '../../components/art-sales/ArtSaleList';
import CourseList from '../../components/courses/CourseList';

type TabType = 'flea-market' | 'art-sales' | 'courses';

const tabIcons: Record<TabType, React.ReactNode> = {
  'flea-market': <ShoppingBag className="w-5 h-5" />,
  'art-sales': <Palette className="w-5 h-5" />,
  'courses': <GraduationCap className="w-5 h-5" />,
};

const tabKeys: TabType[] = ['flea-market', 'art-sales', 'courses'];

const tabTranslationKeys: Record<TabType, string> = {
  'flea-market': 'fleaMarket',
  'art-sales': 'artSales',
  'courses': 'courses',
};

const BusinessPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'flea-market';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'flea-market':
        return <FleaMarketList />;
      case 'art-sales':
        return <ArtSaleList />;
      case 'courses':
        return <CourseList />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => navigate('/feed')}
              className="flex items-center text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('business.backToHome')}
            </button>
          </div>
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">ビジネス</h1>
            <p className="text-xl text-gray-600 mb-2">フリマ・作品販売・講座</p>
            <p className="text-sm text-gray-500">
              手数料はかかりません。ユーザー同士で販売ができます。<br />
              ※非会員の方も購入可能
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabKeys.map((tabId) => (
              <button
                key={tabId}
                onClick={() => handleTabChange(tabId)}
                className={`flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tabId
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tabIcons[tabId]}
                <span>{t(`business.tabs.${tabTranslationKeys[tabId]}`)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          {renderTabContent()}
        </div>
      </section>
    </div>
  );
};

export default BusinessPage;
