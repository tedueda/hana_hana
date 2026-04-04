import React from 'react';
import { ShoppingBag, Palette, GraduationCap } from 'lucide-react';

export type BusinessCategory = 'all' | 'flea-market' | 'art-sales' | 'courses';

interface BusinessFilterProps {
  activeCategory: BusinessCategory;
  onCategoryChange: (category: BusinessCategory) => void;
}

const categories: { id: BusinessCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'すべて', icon: null },
  { id: 'flea-market', label: 'フリマ', icon: <ShoppingBag className="w-4 h-4" /> },
  { id: 'art-sales', label: '作品販売', icon: <Palette className="w-4 h-4" /> },
  { id: 'courses', label: '講座レッスン', icon: <GraduationCap className="w-4 h-4" /> },
];

const BusinessFilter: React.FC<BusinessFilterProps> = ({ activeCategory, onCategoryChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange(cat.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeCategory === cat.id
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {cat.icon}
          {cat.label}
        </button>
      ))}
    </div>
  );
};

export default BusinessFilter;
