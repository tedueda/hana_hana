import React from 'react';
import { MapPin } from 'lucide-react';
import { IdentityBadge } from '@/components/ui/IdentityBadge';

export interface MatchingCardItem {
  user_id: number;
  display_name?: string;
  identity?: string | null;
  nationality?: string | null;
  prefecture?: string | null;
  age_band?: string | null;
  avatar_url?: string | null;
  meet_pref?: string | null;
}

interface MatchingCardProps {
  item: MatchingCardItem;
  blurred?: boolean;
  onClick?: () => void;
}

const getFlagImageUrl = (code: string | null | undefined): string => {
  if (!code || code === 'OTHER') return '';
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
};

const MatchingCard: React.FC<MatchingCardProps> = ({ item, blurred = true, onClick }) => {
  return (
    <article
      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md cursor-pointer"
      onClick={onClick}
    >
      {/* Image area */}
      <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200">
        {/* Blurred avatar placeholder */}
        <div className={`h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 ${blurred ? 'blur-sm' : ''}`}>
          <div className="w-20 h-20 bg-gray-400 rounded-full flex items-center justify-center">
            <span className="text-white text-3xl">👤</span>
          </div>
        </div>

        {/* Nationality badge (top-left) */}
        {item.nationality && (
          <div className="absolute left-2 top-2 bg-white/90 rounded-full px-1.5 py-1 shadow-sm z-10 flex items-center gap-1">
            {getFlagImageUrl(item.nationality) ? (
              <img
                src={getFlagImageUrl(item.nationality)}
                alt={item.nationality}
                className="w-6 h-4 object-cover rounded-sm"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : null}
            <span className="text-xs font-medium text-gray-700">{item.nationality}</span>
          </div>
        )}

        {/* Identity badge (top-right) */}
        {item.identity && (
          <div className="absolute right-2 top-2">
            <IdentityBadge value={item.identity} />
          </div>
        )}

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-bold truncate">{item.display_name || 'ユーザー'}</span>
            {item.age_band && (
              <span className="text-xs opacity-90 bg-white/20 px-1.5 py-0.5 rounded">{item.age_band}</span>
            )}
          </div>
          {item.prefecture && (
            <div className="flex items-center gap-1 text-xs opacity-80">
              <MapPin className="w-3 h-3" />
              <span>{item.prefecture}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div className="p-2.5">
        {item.meet_pref && (
          <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {item.meet_pref}
          </span>
        )}
      </div>
    </article>
  );
};

export default MatchingCard;
