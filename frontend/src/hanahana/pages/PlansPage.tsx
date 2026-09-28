import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '../i18n';
import { useErrorMessage } from '../hooks';
import { fetchPlans, fetchMyPlanUsage, remaining, TIER_KEY, TIER_ORDER, type PaidTier, type Plan, type PlanTier, type PlanUsage } from '../api/plans';
import { fetchPublicSettings, type PublicSettings } from '../api/settings';
import { BillingError, startCheckout } from '../api/billing';
import { PageHeader } from './SettingsPage';
import { FemaleFreeNotice, PlanCard, PlanCommonSection, PlanTermsSection, TIER_BADGE, type Limits } from '../components/PlanComparison';
import type { MessageKey } from '../i18n/ja';

const isPaidTier = (t: PlanTier): t is PaidTier => t !== 'free';

const UsageBar: React.FC<{ label: string; used: number; limit: number | null }> = ({ label, used, limit }) => {
  const { t } = useI18n();
  const rem = remaining(used, limit);
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>
          {used}
          {limit === null ? ` / ${t('plans.unlimited')}` : ` / ${limit}`}
          {rem !== null && <span className="ml-1 text-gray-400">({t('plans.usage.remaining', { n: rem })})</span>}
        </span>
      </div>
      <div className="h-1.5 rounded bg-gray-100 mt-1">
        <div className={`h-1.5 rounded ${pct >= 100 ? 'bg-rose-500' : 'bg-rose-300'}`} style={{ width: `${limit === null ? 100 : pct}%` }} />
      </div>
    </div>
  );
};

export const PlansPage: React.FC = () => {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [pub, setPub] = useState<PublicSettings | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [params] = useSearchParams();

  const choose = async (tier: PlanTier) => {
    if (!isPaidTier(tier)) return;
    setBusy(tier);
    setError('');
    try {
      const { url } = await startCheckout(tier);
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof BillingError ? t(`billing.err.${e.code}` as MessageKey) : errMsg(e));
      setBusy(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPlans(), fetchMyPlanUsage(), fetchPublicSettings()])
      .then(([p, u, s]) => {
        if (cancelled) return;
        setPlans(p);
        setUsage(u);
        setPub(s);
      })
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => {
      cancelled = true;
    };
  }, [errMsg]);

  const limits = useMemo<Limits>(() => (pub?.plan_limits as Limits | undefined) ?? {}, [pub]);
  const current = usage?.tier ?? 'free';
  const exempt = usage?.exempt ?? false;
  const genders = pub?.free_full_access_genders ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title={t('plans.title')} back="/app/profile" />
      <p className="text-sm text-gray-700">{t('plans.lead')}</p>
      <FemaleFreeNotice settings={pub} />
      {params.get('checkout') === 'cancel' && <p className="text-sm text-amber-700">{t('plans.checkoutCanceled')}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {usage && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{t('plans.current')}</h2>
            <Badge className={TIER_BADGE[current]} variant={current === 'free' ? 'secondary' : 'default'} data-testid="current-tier">
              {exempt ? t('plans.exemptBadge') : t(TIER_KEY[current])}
            </Badge>
          </div>
          {exempt && <p className="text-xs text-gray-600">{t('plans.exemptLead')}</p>}
          <h3 className="text-xs font-medium text-gray-500">{t('plans.usage.title')}</h3>
          {usage.likes_per_day !== null && <UsageBar label={t('plans.usage.likes')} used={usage.likes_today} limit={usage.likes_per_day} />}
          {(usage.likes_per_month !== null || usage.likes_per_day === null) && (
            <UsageBar label={t('plans.usage.likesMonth')} used={usage.likes_month} limit={usage.likes_per_month} />
          )}
          <UsageBar label={t('plans.usage.messages')} used={usage.messages_month} limit={usage.messages_per_month} />
          <UsageBar label={t('plans.usage.translations')} used={usage.translations_today} limit={usage.translations_per_day} />
          {!exempt && (
            <Link to="/app/plans/manage" className="text-sm text-rose-600 inline-flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              {t('plans.manageLink')}
            </Link>
          )}
        </section>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">{genders.length ? t('plans.malePlans') : t('plans.allPlans')}</h2>
        {plans.map((p) => {
          const isCurrent = p.tier === current;
          const isPaid = p.tier !== 'free';
          const isUpgrade = TIER_ORDER[p.tier] > TIER_ORDER[current];
          return (
            <PlanCard
              key={p.id}
              plan={p}
              limits={limits[p.tier] ?? {}}
              isCurrent={isCurrent}
              action={
                isPaid && !isCurrent && !exempt ? (
                  <Button className="w-full" disabled={busy !== null} onClick={() => void choose(p.tier)} data-testid={`choose-${p.tier}`}>
                    {busy === p.tier ? t('plans.redirecting') : isUpgrade ? t('plans.choose') : t('plans.change')}
                  </Button>
                ) : null
              }
            />
          );
        })}
      </div>

      <PlanCommonSection />
      <PlanTermsSection settings={pub} limits={limits} plans={plans} />

      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 px-1">
        <Link to="/app/terms" className="underline py-1">{t('landing.footer.terms')}</Link>
        <Link to="/app/privacy" className="underline py-1">{t('landing.footer.privacy')}</Link>
        <Link to="/app/legal-notice" className="underline py-1">{t('landing.footer.legalNotice')}</Link>
      </nav>
    </div>
  );
};
