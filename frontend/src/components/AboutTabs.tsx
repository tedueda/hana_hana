import React from 'react';
import { Users, MessageCircle, Briefcase } from 'lucide-react';

export type AboutTabType = 'matching' | 'salon' | 'business';

interface AboutTabsProps {
  activeTab: AboutTabType;
  onTabChange: (tab: AboutTabType) => void;
}

const tabs: { id: AboutTabType; label: string; shortLabel: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'matching',
    label: '会員交流',
    shortLabel: '交流',
    description: 'メンバーと気軽に交流',
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: 'salon',
    label: '会員サロン',
    shortLabel: 'サロン',
    description: '安心して交流できる場所',
    icon: <MessageCircle className="w-5 h-5" />,
  },
  {
    id: 'business',
    label: 'ビジネス',
    shortLabel: 'ビジネス',
    description: '販売・講座・仕事',
    icon: <Briefcase className="w-5 h-5" />,
  },
];

const AboutTabs: React.FC<AboutTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 px-2 md:px-4 py-3 md:py-4 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-1.5 md:gap-2">
                {tab.icon}
                <span className="text-sm md:text-base md:hidden">{tab.shortLabel}</span>
                <span className="text-sm md:text-base hidden md:inline">{tab.label}</span>
              </div>
              <span className="text-xs text-gray-500 hidden md:block">{tab.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AboutTabs;
