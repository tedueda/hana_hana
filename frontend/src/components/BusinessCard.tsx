import React from 'react';
import { MapPin, Clock, User } from 'lucide-react';

export interface BusinessCardItem {
  id: number;
  title: string;
  description?: string;
  price?: number;
  price_label?: string;
  category: string;
  region?: string | null;
  created_at: string;
  images?: { id: number; image_url: string; display_order: number }[];
  user_display_name?: string | null;
  user_avatar_url?: string | null;
  owner_display_name?: string | null;
  owner_avatar_url?: string | null;
}

interface BusinessCardProps {
  item: BusinessCardItem;
  onClick?: () => void;
  type: 'flea-market' | 'art-sales' | 'courses';
}

const formatPrice = (price: number | undefined): string => {
  if (price === undefined || price === null) return '';
  if (price === 0) return '価格相談';
  return `¥${price.toLocaleString()}`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  if (diffDays < 7) return `${diffDays}日前`;
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
};

const BusinessCard: React.FC<BusinessCardProps> = ({ item, onClick, type }) => {
  const displayName = item.user_display_name || item.owner_display_name || '匿名';
  const avatarUrl = item.user_avatar_url || item.owner_avatar_url;
  const priceDisplay = item.price_label || formatPrice(item.price);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-100">
        {item.images && item.images.length > 0 ? (
          <img
            src={item.images[0].image_url}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">
              {type === 'flea-market' ? '📦' : type === 'art-sales' ? '🎨' : '📚'}
            </span>
          </div>
        )}
        {item.images && item.images.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            +{item.images.length - 1}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{item.title}</h3>
        {priceDisplay && (
          <p className="text-lg font-bold text-gray-900 mb-2">{priceDisplay}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {item.region && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {item.region}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(item.created_at)}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
          )}
          <span className="text-sm text-gray-600">{displayName}</span>
        </div>
      </div>
    </div>
  );
};

export default BusinessCard;
