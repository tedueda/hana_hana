import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Heart, MessageCircle, Search, Sparkles, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '../labels';

const NAV = [
  { to: '/app', label: 'おすすめ', icon: Sparkles, end: true },
  { to: '/app/search', label: '探す', icon: Search },
  { to: '/app/likes', label: 'いいね', icon: Heart },
  { to: '/app/matches', label: 'メッセージ', icon: MessageCircle },
  { to: '/app/profile', label: 'プロフィール', icon: UserRound },
];

const AppShell: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col">
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
        <span className="font-bold text-rose-600 tracking-wide">{APP_NAME}</span>
        <nav className="hidden md:flex gap-1">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('px-3 py-1.5 rounded-md text-sm', isActive ? 'bg-rose-50 text-rose-600 font-medium' : 'text-gray-600 hover:bg-gray-100')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>

    <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 pb-24 md:pb-8">
      <Outlet />
    </main>

    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('flex flex-col items-center py-2 text-[11px]', isActive ? 'text-rose-600' : 'text-gray-500')
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  </div>
);

export default AppShell;
