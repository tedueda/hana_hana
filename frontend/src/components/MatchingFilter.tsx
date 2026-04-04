import React from 'react';

export type MatchingCategory = 'all' | 'lesbian' | 'gay' | 'other';

interface MatchingFilterProps {
  activeCategory: MatchingCategory;
  onCategoryChange: (category: MatchingCategory) => void;
}

const categories: { id: MatchingCategory; label: string; shortLabel: string }[] = [
  { id: 'all', label: 'すべて', shortLabel: 'すべて' },
  { id: 'lesbian', label: 'L（レズ）', shortLabel: 'L' },
  { id: 'gay', label: 'G（ゲイ）', shortLabel: 'G' },
  { id: 'other', label: 'その他', shortLabel: 'その他' },
];

const MatchingFilter: React.FC<MatchingFilterProps> = ({ activeCategory, onCategoryChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange(cat.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeCategory === cat.id
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
};

export default MatchingFilter;
