import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Heart, MessageCircle, Users, Languages, ShieldCheck, UserCheck, Flag, Ban, Eye, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/ja';
import PublicLayout from '../components/PublicLayout';
import { PageHeader } from './SettingsPage';

const FEATURES: { icon: LucideIcon; title: MessageKey; body: MessageKey }[] = [
  { icon: Search, title: 'about.f.search.title', body: 'about.f.search.body' },
  { icon: Heart, title: 'about.f.match.title', body: 'about.f.match.body' },
  { icon: MessageCircle, title: 'about.f.chat.title', body: 'about.f.chat.body' },
  { icon: Users, title: 'about.f.salon.title', body: 'about.f.salon.body' },
  { icon: Languages, title: 'about.f.lang.title', body: 'about.f.lang.body' },
];

const SAFETY: { icon: LucideIcon; title: MessageKey; body: MessageKey }[] = [
  { icon: UserCheck, title: 'about.s.age.title', body: 'about.s.age.body' },
  { icon: ShieldCheck, title: 'about.s.verify.title', body: 'about.s.verify.body' },
  { icon: Flag, title: 'about.s.report.title', body: 'about.s.report.body' },
  { icon: Ban, title: 'about.s.block.title', body: 'about.s.block.body' },
  { icon: Eye, title: 'about.s.mod.title', body: 'about.s.mod.body' },
];

const STEPS: MessageKey[] = ['about.step1', 'about.step2', 'about.step3', 'about.step4', 'about.step5'];

const AboutBody: React.FC<{ loggedIn: boolean }> = ({ loggedIn }) => {
  const { t } = useI18n();
  return (
    <main className="max-w-3xl mx-auto px-4 pb-10 space-y-10">
      <section className="text-center pt-6 space-y-4" data-testid="about-hero">
        <p className="text-xs font-semibold tracking-widest text-rose-500">HANA-HANA</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 whitespace-pre-line break-keep">{t('about.hero.title')}</h1>
        <p className="text-gray-600 break-keep">{t('about.hero.sub')}</p>
        {!loggedIn && (
          <div className="flex flex-row justify-center gap-3 pt-2">
            <Button asChild size="lg" className="bg-rose-600 hover:bg-rose-700 h-12"><Link to="/app/register">{t('landing.start')}</Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12 bg-white/80"><Link to="/app/pricing">{t('public.nav.pricing')}</Link></Button>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-rose-100 p-5 space-y-3" data-testid="about-concept">
        <h2 className="text-lg font-bold text-gray-900">{t('about.concept.title')}</h2>
        <p className="text-sm text-gray-700 leading-relaxed break-keep">{t('about.concept.p1')}</p>
        <p className="text-sm text-gray-700 leading-relaxed break-keep">{t('about.concept.p2')}</p>
        <p className="text-sm text-gray-700 leading-relaxed break-keep">{t('about.concept.p3')}</p>
      </section>

      <section className="space-y-3" data-testid="about-features">
        <h2 className="text-lg font-bold text-gray-900">{t('about.features.title')}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white rounded-2xl border border-rose-100 p-4 flex gap-3">
              <Icon className="w-6 h-6 text-rose-500 shrink-0" aria-hidden />
              <div>
                <h3 className="font-semibold text-gray-900">{t(title)}</h3>
                <p className="text-sm text-gray-600 mt-1 break-keep">{t(body)}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 break-keep">{t('about.features.note')}</p>
      </section>

      <section className="space-y-3" data-testid="about-safety">
        <h2 className="text-lg font-bold text-gray-900">{t('about.safety.title')}</h2>
        <p className="text-sm text-gray-600 break-keep">{t('about.safety.lead')}</p>
        <ul className="grid sm:grid-cols-2 gap-3">
          {SAFETY.map(({ icon: Icon, title, body }) => (
            <li key={title} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
              <Icon className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden />
              <div>
                <h3 className="font-semibold text-gray-900">{t(title)}</h3>
                <p className="text-sm text-gray-600 mt-1 break-keep">{t(body)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500 break-keep">{t('about.safety.note')}</p>
      </section>

      <section className="space-y-3" data-testid="about-steps">
        <h2 className="text-lg font-bold text-gray-900">{t('about.steps.title')}</h2>
        <ol className="space-y-2">
          {STEPS.map((k, i) => (
            <li key={k} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 items-start">
              <span className="w-7 h-7 rounded-full bg-rose-500 text-white text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <p className="text-sm text-gray-700 break-keep">{t(k)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="text-center space-y-3 bg-rose-600 text-white rounded-3xl p-6" data-testid="about-cta">
        <h2 className="text-xl font-bold whitespace-pre-line break-keep">{t('about.cta.title')}</h2>
        <p className="text-sm text-rose-50 break-keep">{t('about.cta.sub')}</p>
        {loggedIn ? (
          <Button asChild size="lg" variant="secondary" className="h-12"><Link to="/app">{t('about.cta.toApp')}</Link></Button>
        ) : (
          <Button asChild size="lg" variant="secondary" className="h-12"><Link to="/app/register">{t('landing.start')}</Link></Button>
        )}
        <p className="text-xs text-rose-100">
          <Link to="/app/pricing" className="underline">{t('public.nav.pricing')}</Link>
          {' · '}
          <Link to="/app/terms" className="underline">{t('legal.terms')}</Link>
        </p>
      </section>
    </main>
  );
};

/** ログイン前は公開レイアウト、ログイン後は設定配下と同じヘッダーで表示 */
const AboutPage: React.FC = () => {
  const { session, isLoading } = useSupabaseAuth();
  const { t } = useI18n();
  if (isLoading) return null;
  if (session) {
    return (
      <div className="min-h-screen bg-gray-50 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <PageHeader title={t('public.nav.about')} back="/app/settings" />
        </div>
        <AboutBody loggedIn />
      </div>
    );
  }
  return (
    <PublicLayout>
      <AboutBody loggedIn={false} />
    </PublicLayout>
  );
};

export default AboutPage;
