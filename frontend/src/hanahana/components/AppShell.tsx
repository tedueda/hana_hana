import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { HeartHandshake, MessageCircle, Search, Sparkles, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '../labels';
import { useI18n } from '../i18n';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { fetchUnreadCounts } from '../api/messages';
import type { MessageKey } from '../i18n/ja';

const NAV: { to: string; key: MessageKey; icon: React.ElementType; end?: boolean; badge?: 'unread' }[] = [
  { to: '/app', key: 'nav.recommend', icon: Sparkles, end: true },
  { to: '/app/search', key: 'nav.search', icon: Search },
  { to: '/app/matches', key: 'nav.matches', icon: HeartHandshake },
  { to: '/app/chats', key: 'nav.chats', icon: MessageCircle, badge: 'unread' },
  { to: '/app/profile', key: 'nav.my', icon: UserRound },
];

function useUnreadTotal(): number {
  const { user } = useSupabaseAuth();
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () =>
      fetchUnreadCounts(user.id)
        .then((m) => alive && setTotal([...m.values()].reduce((a, b) => a + b, 0)))
        .catch(() => undefined);
    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [user]);
  return total;
}

const AppShell: React.FC = () => {
  const { t } = useI18n();
  const unread = useUnreadTotal();

  const renderBadge = (badge?: 'unread') =>
    badge === 'unread' && unread > 0 ? (
      <span
        aria-label={t('chats.unreadAria', { n: unread })}
        className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center"
      >
        {unread > 99 ? '99+' : unread}
      </span>
    ) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <span className="font-bold text-rose-600 tracking-wide">{APP_NAME}</span>
          <nav className="hidden md:flex gap-1">
            {NAV.map(({ to, key, end, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('relative px-3 py-1.5 rounded-md text-sm', isActive ? 'bg-rose-50 text-rose-600 font-medium' : 'text-gray-600 hover:bg-gray-100')
                }
              >
                {t(key)}
                {renderBadge(badge)}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 pb-24 md:pb-8">
        <Outlet />
      </main>

      <nav
        aria-label="main"
        className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5">
          {NAV.map(({ to, key, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center min-h-[56px] py-2 text-[11px] focus:outline-none focus-visible:bg-rose-50',
                  isActive ? 'text-rose-600 font-medium' : 'text-gray-500',
                )
              }
            >
              <span className="relative">
                <Icon className="w-6 h-6 mb-0.5" aria-hidden />
                {renderBadge(badge)}
              </span>
              {t(key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
