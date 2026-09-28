import React, { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Bell, Flag, ListChecks, ScrollText, ShieldCheck, Users, UserCog, MessagesSquare, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchAdminRole, type AdminRole } from '../api/admin';
import { APP_NAME } from '../labels';
import { AdminRoleContext } from './context';

const NAV = [
  { to: '/app/admin', label: 'ダッシュボード', icon: BarChart3, end: true },
  { to: '/app/admin/users', label: '会員管理', icon: Users },
  { to: '/app/admin/reports', label: '通報管理', icon: Flag },
  { to: '/app/admin/salon', label: '交流サロン', icon: MessagesSquare },
  { to: '/app/admin/events', label: 'イベント', icon: CalendarDays },
  { to: '/app/admin/verifications', label: '本人確認', icon: ShieldCheck },
  { to: '/app/admin/masters', label: 'カテゴリー', icon: ListChecks },
  { to: '/app/admin/announcements', label: 'お知らせ', icon: Bell },
  { to: '/app/admin/audit', label: '操作ログ', icon: ScrollText },
  { to: '/app/admin/admins', label: '管理者', icon: UserCog },
];

const AdminShell: React.FC = () => {
  const [role, setRole] = useState<AdminRole | null | undefined>(undefined);

  useEffect(() => {
    fetchAdminRole().then(setRole).catch(() => setRole(null));
  }, []);

  if (role === undefined) return <div className="min-h-screen flex items-center justify-center text-gray-500">権限を確認中…</div>;
  if (role === null) return <Navigate to="/app" replace />;

  return (
    <AdminRoleContext.Provider value={role}>
      <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
        <aside className="bg-slate-900 text-slate-100 md:w-56 md:min-h-screen shrink-0">
          <div className="px-4 h-12 flex items-center justify-between border-b border-slate-700">
            <span className="font-bold tracking-wide">{APP_NAME} 管理</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700">{role}</span>
          </div>
          <nav className="flex md:flex-col overflow-x-auto md:overflow-visible">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap', isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800')
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            <NavLink to="/app" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 whitespace-nowrap md:mt-auto">
              ← アプリへ戻る
            </NavLink>
          </nav>
        </aside>
        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full">
          <Outlet />
        </main>
      </div>
    </AdminRoleContext.Provider>
  );
};

export default AdminShell;
