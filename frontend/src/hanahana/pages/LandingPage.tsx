import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Globe2, HeartHandshake, Languages, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/ja';
import HeroSlider from '../components/HeroSlider';
import PublicLayout from '../components/PublicLayout';

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

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto sm:px-4">
        <div className="sm:rounded-3xl overflow-hidden shadow-sm">
          <HeroSlider>
            <div className="flex flex-row gap-3">
              <Button asChild size="lg" className="bg-rose-600 hover:bg-rose-700 h-12 flex-1 sm:flex-none"><Link to="/app/register">{t('landing.start')}</Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12 bg-white/80 flex-1 sm:flex-none"><Link to="/app/login">{t('landing.login')}</Link></Button>
            </div>
          </HeroSlider>
        </div>
      </div>
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <section className="text-center">
          <p className="text-gray-600 break-keep">{t('landing.lead')}</p>
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
        <section className="flex flex-col sm:flex-row justify-center gap-3">
          <Button asChild variant="outline" className="h-11 bg-white"><Link to="/app/about">{t('public.nav.about')}</Link></Button>
          <Button asChild variant="outline" className="h-11 bg-white"><Link to="/app/pricing">{t('public.nav.pricing')}</Link></Button>
        </section>
      </main>
    </PublicLayout>
  );
};

export default LandingPage;
