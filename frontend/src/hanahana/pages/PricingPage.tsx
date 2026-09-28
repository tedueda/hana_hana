import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { useI18n } from '../i18n';
import { useErrorMessage } from '../hooks';
import { fetchPublicPlans, type Plan } from '../api/plans';
import { fetchPublicSettings, type PublicSettings } from '../api/settings';
import PublicLayout from '../components/PublicLayout';
import { FemaleFreeNotice, PlanCard, PlanCommonSection, PlanTermsSection, type Limits } from '../components/PlanComparison';

/**
 * ログイン前の料金プラン。ログイン後の /app/plans と同じ部品 (PlanComparison) と同じデータ源
 * (public_plans / public_settings) を使い、内容の食い違いを防ぐ。購入ボタンは置かず、登録へ誘導する。
 */
const PricingPage: React.FC = () => {
  const { session, isLoading } = useSupabaseAuth();
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pub, setPub] = useState<PublicSettings | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPublicPlans(), fetchPublicSettings()])
      .then(([p, s]) => {
        if (cancelled) return;
        setPlans(p);
        setPub(s);
      })
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => {
      cancelled = true;
    };
  }, [errMsg]);

  const limits = useMemo<Limits>(() => (pub?.plan_limits as Limits | undefined) ?? {}, [pub]);
  const genders = pub?.free_full_access_genders ?? [];

  if (!isLoading && session) return <Navigate to="/app/plans" replace />;

  return (
    <PublicLayout className="bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 pb-10 space-y-4">
        <section className="text-center pt-6 pb-2 space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{t('plans.title')}</h1>
          <p className="text-sm text-gray-700 break-keep">{t('plans.lead')}</p>
          <p className="text-xs text-gray-500">{t('pricing.taxNote')}</p>
        </section>
        <FemaleFreeNotice settings={pub} />
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">{genders.length ? t('plans.malePlans') : t('plans.allPlans')}</h2>
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              limits={limits[p.tier] ?? {}}
              action={
                <Button asChild variant={p.tier === 'free' ? 'default' : 'outline'} className="w-full" data-testid={`register-${p.tier}`}>
                  <Link to="/app/register">{p.tier === 'free' ? t('landing.start') : t('pricing.registerThenChoose')}</Link>
                </Button>
              }
            />
          ))}
          {plans.length === 0 && !error && <p className="text-sm text-gray-500">{t('common.loading')}</p>}
        </div>

        <PlanCommonSection />
        <PlanTermsSection settings={pub} limits={limits} plans={plans} />

        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">{t('pricing.howToPay.title')}</h2>
          <p className="text-xs text-gray-600 break-keep">{t('pricing.howToPay.body')}</p>
        </section>

        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 px-1" aria-label={t('legal.related')}>
          <Link to="/app/terms" className="underline py-1">{t('landing.footer.terms')}</Link>
          <Link to="/app/privacy" className="underline py-1">{t('landing.footer.privacy')}</Link>
          <Link to="/app/legal-notice" className="underline py-1">{t('landing.footer.legalNotice')}</Link>
          <Link to="/app/about" className="underline py-1">{t('public.nav.about')}</Link>
        </nav>
      </main>
    </PublicLayout>
  );
};

export default PricingPage;
