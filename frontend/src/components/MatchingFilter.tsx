import React from 'react';

export type IdentityFilter = 'all' | 'recommended' | 'gay' | 'lesbian' | 'bisexual' | 'transgender' | 'queer' | 'ally_other';

export interface MatchingSearchFilters {
  nationality: string;
  ageBand: string;
  occupation: string;
  meetPref: string;
  identity: IdentityFilter;
}

export const DEFAULT_MATCHING_FILTERS: MatchingSearchFilters = {
  nationality: '',
  ageBand: '',
  occupation: '',
  meetPref: '',
  identity: 'recommended',
};

export interface MatchingFilterOptions {
  nationalities: string[];
  ageBands: string[];
  occupations: string[];
  meetPrefs: string[];
}

interface MatchingFilterProps {
  value: MatchingSearchFilters;
  onChange: (next: MatchingSearchFilters) => void;
  options: MatchingFilterOptions;
  userCategory?: string | null;
}

const selectClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9';
// Chevron via inline SVG data URI for consistent look across browsers
const chevronBg =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")";

const CATEGORY_TABS: { key: IdentityFilter; label: string }[] = [
  { key: 'recommended', label: 'おすすめ' },
  { key: 'all', label: 'すべて' },
  { key: 'gay', label: 'G' },
  { key: 'lesbian', label: 'L' },
  { key: 'bisexual', label: 'B' },
  { key: 'transgender', label: 'T' },
  { key: 'queer', label: 'Q' },
  { key: 'ally_other', label: 'S' },
];

export { CATEGORY_TABS };

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}> = ({ label, value, onChange, options }) => (
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="text-xs font-medium text-gray-500">{label}</span>
    <div className="relative">
      <select
        className={selectClass}
        style={{ backgroundImage: `${chevronBg}` }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">すべて</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  </div>
);

// Map user's community_category value to IdentityFilter key
const categoryToFilterKey = (category: string | null | undefined): IdentityFilter | null => {
  if (!category) return null;
  const map: Record<string, IdentityFilter> = {
    'ゲイ': 'gay', 'gay': 'gay',
    'レズビアン': 'lesbian', 'レズ': 'lesbian', 'lesbian': 'lesbian',
    'バイセクシュアル': 'bisexual', 'バイセクシャル': 'bisexual', 'bisexual': 'bisexual', 'バイ': 'bisexual',
    'トランスジェンダー': 'transgender', 'transgender': 'transgender', 'トランス': 'transgender',
    'クィア': 'queer', 'クエスチョニング': 'queer', 'questioning': 'queer', 'queer': 'queer',
    'ストレート・アライ': 'ally_other', 'その他': 'ally_other', 'other': 'ally_other', 'ally_other': 'ally_other', '男性': 'ally_other', '女性': 'ally_other',
  };
  return map[category] || null;
};

export { categoryToFilterKey };

const MatchingFilter: React.FC<MatchingFilterProps> = ({ value, onChange, options, userCategory }) => {
  const patch = (partial: Partial<MatchingSearchFilters>) => {
    onChange({ ...value, ...partial });
  };

  // Filter tabs: show only おすすめ, すべて, and user's own category
  const userFilterKey = categoryToFilterKey(userCategory);
  const visibleTabs = (userCategory && userFilterKey)
    ? CATEGORY_TABS.filter(tab => tab.key === 'recommended' || tab.key === 'all' || tab.key === userFilterKey)
    : CATEGORY_TABS;

  // Reset identity filter if the selected tab is no longer visible (e.g. after async userCategory load)
  const visibleKeys = visibleTabs.map(t => t.key);
  if (!visibleKeys.includes(value.identity)) {
    onChange({ ...value, identity: 'recommended' });
  }

  return (
    <div className="space-y-4">
      {/* カテゴリータブ */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">コミュニティ別に見る</h3>
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => patch({ identity: tab.key })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                value.identity === tab.key
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 条件検索 */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">カテゴリーを切り替える</h3>
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4">
          <Field
            label="国籍"
            value={value.nationality}
            onChange={(nationality) => patch({ nationality })}
            options={options.nationalities}
          />
          <Field
            label="年代"
            value={value.ageBand}
            onChange={(ageBand) => patch({ ageBand })}
            options={options.ageBands}
          />
          <Field
            label="職種"
            value={value.occupation}
            onChange={(occupation) => patch({ occupation })}
            options={options.occupations}
          />
          <Field
            label="マッチングの目的"
            value={value.meetPref}
            onChange={(meetPref) => patch({ meetPref })}
            options={options.meetPrefs}
          />
        </div>
      </div>
    </div>
  );
};

export default MatchingFilter;
