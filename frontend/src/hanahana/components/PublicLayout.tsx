import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '../labels';
import { useI18n } from '../i18n';
import LangSwitch from '../components/LangSwitch';
import type { MessageKey } from '../i18n/ja';

/** ログイン前ページ共通のヘッダー・フッター (トップ / Hana-Hanaについて / 料金プラン / 規約類) */

const NAV: { to: string; label: MessageKey }[] = [
  { to: '/app/about', label: 'public.nav.about' },
  { to: '/app/pricing', label: 'public.nav.pricing' },
];

export const PublicHeader: React.FC = () => {
  const { t } = useI18n();
  return (
    <header className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
      <Link to="/app/welcome" className="font-bold text-rose-600 text-lg shrink-0">{APP_NAME}</Link>
      <nav className="hidden sm:flex items-center gap-1 text-sm" aria-label={t('public.nav.aria')}>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `px-3 py-2 rounded-lg ${isActive ? 'text-rose-700 font-semibold' : 'text-gray-700 hover:text-rose-600'}`}
          >
            {t(n.label)}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <LangSwitch />
        <Button asChild variant="ghost" size="sm" className="h-10"><Link to="/app/login">{t('landing.login')}</Link></Button>
      </div>
    </header>
  );
};

export const PublicFooter: React.FC = () => {
  const { t } = useI18n();
  return (
    <footer className="max-w-3xl mx-auto px-4 pb-8 space-y-3">
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-gray-700 sm:hidden" aria-label={t('public.nav.aria')}>
        {NAV.map((n) => <Link key={n.to} to={n.to} className="py-2 underline">{t(n.label)}</Link>)}
      </nav>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500">
        <Link to="/app/terms" className="underline py-2">{t('landing.footer.terms')}</Link>
        <Link to="/app/privacy" className="underline py-2">{t('landing.footer.privacy')}</Link>
        <Link to="/app/legal-notice" className="underline py-2">{t('landing.footer.legalNotice')}</Link>
        <Link to="/app/help" className="underline py-2">{t('landing.footer.help')}</Link>
      </div>
    </footer>
  );
};

const PublicLayout: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`min-h-screen pt-[env(safe-area-inset-top)] ${className ?? 'bg-gradient-to-b from-rose-50 via-white to-orange-50'}`}>
    <PublicHeader />
    {children}
    <PublicFooter />
  </div>
);

export default PublicLayout;
