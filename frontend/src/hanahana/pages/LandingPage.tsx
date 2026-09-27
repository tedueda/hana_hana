import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Globe2, HeartHandshake, Languages, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { APP_NAME } from '../labels';
import { useI18n } from '../i18n';
import LangSwitch from '../components/LangSwitch';
import type { MessageKey } from '../i18n/ja';

const FEATURES: { icon: React.ElementType; title: MessageKey; body: MessageKey }[] = [
  { icon: Globe2, title: 'landing.f1.title', body: 'landing.f1.body' },
  { icon: HeartHandshake, title: 'landing.f2.title', body: 'landing.f2.body' },
  { icon: Languages, title: 'landing.f3.title', body: 'landing.f3.body' },
  { icon: Sparkles, title: 'landing.f4.title', body: 'landing.f4.body' },
  { icon: ShieldCheck, title: 'landing.f5.title', body: 'landing.f5.body' },
];

const LandingPage: React.FC = () => {
  const { session, isLoading } = useSupabaseAuth();
  const { t } = useI18n();
  if (!isLoading && session) return <Navigate to="/app" replace />;

  const tagline = t('landing.tagline').split('\n');

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-orange-50 pt-[env(safe-area-inset-top)]">
      <header className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <span className="font-bold text-rose-600 text-lg">{APP_NAME}</span>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <Button asChild variant="ghost" size="sm" className="h-10"><Link to="/app/login">{t('landing.login')}</Link></Button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-12">
        <section className="text-center space-y-5">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-gray-900 break-keep">
            {tagline.map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i < tagline.length - 1 && <br />}
              </React.Fragment>
            ))}
          </h1>
          <p className="text-gray-600">{t('landing.lead')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-rose-600 hover:bg-rose-700 h-12"><Link to="/app/register">{t('landing.start')}</Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12"><Link to="/app/login">{t('landing.login')}</Link></Button>
          </div>
        </section>
        <section className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white rounded-2xl border border-rose-100 p-5 flex gap-3">
              <Icon className="w-7 h-7 text-rose-500 shrink-0" aria-hidden />
              <div>
                <h3 className="font-semibold text-gray-900">{t(title)}</h3>
                <p className="text-sm text-gray-600 mt-1">{t(body)}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="text-center text-sm text-gray-500 break-keep">{t('landing.flow')}</section>
        <footer className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500 pb-6">
          <Link to="/app/terms" className="underline py-2">{t('landing.footer.terms')}</Link>
          <Link to="/app/privacy" className="underline py-2">{t('landing.footer.privacy')}</Link>
          <Link to="/app/help" className="underline py-2">{t('landing.footer.help')}</Link>
        </footer>
      </main>
    </div>
  );
};

export default LandingPage;
