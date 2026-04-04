import React from 'react';

export type IdentityFilter = 'all' | 'lesbian' | 'gay' | 'other';

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
  identity: 'all',
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
}

const selectClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9';
// Chevron via inline SVG data URI for consistent look across browsers
const chevronBg =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")";

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

const MatchingFilter: React.FC<MatchingFilterProps> = ({ value, onChange, options }) => {
  const patch = (partial: Partial<MatchingSearchFilters>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">条件検索</h3>
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
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">性自認</span>
          <div className="relative">
            <select
              className={selectClass}
              style={{ backgroundImage: `${chevronBg}` }}
              value={value.identity}
              onChange={(e) => patch({ identity: e.target.value as IdentityFilter })}
            >
              <option value="all">すべて</option>
              <option value="lesbian">レズ</option>
              <option value="gay">ゲイ</option>
              <option value="other">その他</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchingFilter;
