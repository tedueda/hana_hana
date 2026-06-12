import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBag, GraduationCap, Palette } from 'lucide-react';
import { API_URL } from '../../config';

interface BusinessItem {
  id: number;
  title: string;
  price?: number;
  image_url?: string | null;
  thumbnail_url?: string | null;
  images?: string[];
  created_at: string;
  category: 'flea-market' | 'courses' | 'art-sales';
  seller_name?: string;
  instructor_name?: string;
  artist_name?: string;
}

const CATEGORY_CONFIG = {
  'flea-market': { label: 'フリマ', icon: ShoppingBag, color: 'bg-orange-100 text-orange-700' },
  'courses': { label: '講座', icon: GraduationCap, color: 'bg-blue-100 text-blue-700' },
  'art-sales': { label: '作品販売', icon: Palette, color: 'bg-purple-100 text-purple-700' },
};

const PopularBusiness: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<BusinessItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const [fleaRes, courseRes, artRes] = await Promise.all([
          fetch(`${API_URL}/api/flea-market/items?limit=4`).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`${API_URL}/api/courses?limit=4`).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`${API_URL}/api/art-sales/items?limit=4`).then(r => r.ok ? r.json() : []).catch(() => []),
        ]);

        const fleaItems = (Array.isArray(fleaRes) ? fleaRes : fleaRes.items || []).map((i: any) => ({
          ...i, category: 'flea-market' as const,
        }));
        const courseItems = (Array.isArray(courseRes) ? courseRes : courseRes.items || []).map((i: any) => ({
          ...i, category: 'courses' as const,
        }));
        const artItems = (Array.isArray(artRes) ? artRes : artRes.items || []).map((i: any) => ({
          ...i, category: 'art-sales' as const,
        }));

        const all = [...fleaItems, ...courseItems, ...artItems]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 6);

        setItems(all);
      } catch (err) {
        console.error('Failed to fetch business items:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBusiness();
  }, []);

  const getImageUrl = (item: BusinessItem): string | null => {
    const resolve = (u: unknown): string | null => {
      if (!u || typeof u !== 'string') return null;
      return u.startsWith('http') ? u : `${API_URL}${u}`;
    };
    return resolve(item.thumbnail_url) || resolve(item.image_url) || resolve(item.images?.[0]) || null;
  };

  const getDisplayName = (item: BusinessItem): string => {
    return item.seller_name || item.instructor_name || item.artist_name || '';
  };

  const handleClick = (item: BusinessItem) => {
    navigate(`/business?tab=${item.category}`);
  };

  if (!loading && items.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-6 gap-2">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900">人気のビジネス</h2>
            <p className="text-sm text-gray-500 mt-1">フリマ・作品販売・講座 ── 手数料無料で直接やり取り</p>
          </div>
          <button
            onClick={() => navigate('/business')}
            className="text-gray-600 hover:text-black font-medium text-sm flex items-center gap-1 self-start md:self-auto"
          >
            すべて見る <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            {items.map((item) => {
              const config = CATEGORY_CONFIG[item.category];
              const Icon = config.icon;
              const imgUrl = getImageUrl(item);

              return (
                <article
                  key={`${item.category}-${item.id}`}
                  onClick={() => handleClick(item)}
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="relative aspect-square bg-gray-100">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <Icon className="h-10 w-10 text-gray-300" />
                      </div>
                    )}
                    <span className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">{item.title}</p>
                    {item.price != null && (
                      <p className="text-sm font-bold text-gray-900">¥{item.price.toLocaleString()}</p>
                    )}
                    {getDisplayName(item) && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{getDisplayName(item)}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularBusiness;
