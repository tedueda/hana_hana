import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Minus, Crown, Sparkles, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '../i18n';
import { useErrorMessage } from '../hooks';
import { fetchPlans, fetchMyPlanUsage, planFeatures, remaining, TIER_KEY, TIER_ORDER, type Plan, type PlanTier, type PlanUsage } from '../api/plans';
import { fetchPublicSettings, type PublicSettings } from '../api/settings';
import { BillingError, startCheckout } from '../api/billing';
import { PageHeader } from './SettingsPage';
import type { MessageKey } from '../i18n/ja';

type Limits = Record<string, { likes_per_day?: number | null; messages_per_month?: number | null; translations_per_day?: number | null }>;

const TIER_STYLE: Record<PlanTier, string> = {
  free: 'border-gray-200',
  standard: 'border-sky-300',
  premium: 'border-rose-400 shadow-md',
};

const Yes: React.FC = () => <Check className="w-4 h-4 text-emerald-600 inline" aria-label="yes" />;
const No: React.FC = () => <Minus className="w-4 h-4 text-gray-300 inline" aria-label="no" />;

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
  const { t, lang } = useI18n();
  const errMsg = useErrorMessage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [pub, setPub] = useState<PublicSettings | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [params] = useSearchParams();

  const choose = async (tier: PlanTier) => {
    if (tier !== 'standard' && tier !== 'premium') return;
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

  const fmtLimit = (n: number | null | undefined, unit: MessageKey) =>
    n === null || n === undefined ? t('plans.unlimited') : `${n}${t(unit)}`;

  const priceLabel = (p: Plan) => `¥${p.price_jpy.toLocaleString(lang === 'ko' ? 'ko-KR' : 'ja-JP')}${t('plans.perMonth')}`;

  return (
    <div className="space-y-4">
      <PageHeader title={t('plans.title')} back="/app/profile" />
      <p className="text-sm text-gray-700">{t('plans.lead')}</p>
      {params.get('checkout') === 'cancel' && <p className="text-sm text-amber-700">{t('plans.checkoutCanceled')}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {usage && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{t('plans.current')}</h2>
            <Badge className={current === 'premium' ? 'bg-rose-500' : current === 'standard' ? 'bg-sky-500' : ''} variant={current === 'free' ? 'secondary' : 'default'}>
              {t(TIER_KEY[current])}
            </Badge>
          </div>
          <h3 className="text-xs font-medium text-gray-500">{t('plans.usage.title')}</h3>
          <UsageBar label={t('plans.usage.likes')} used={usage.likes_today} limit={usage.likes_per_day} />
          <UsageBar label={t('plans.usage.messages')} used={usage.messages_month} limit={usage.messages_per_month} />
          <UsageBar label={t('plans.usage.translations')} used={usage.translations_today} limit={usage.translations_per_day} />
          <Link to="/app/plans/manage" className="text-sm text-rose-600 inline-flex items-center gap-1">
            <CreditCard className="w-4 h-4" />
            {t('plans.manageLink')}
          </Link>
        </section>
      )}

      <div className="space-y-3">
        {plans.map((p) => {
          const f = planFeatures(p);
          const l = limits[p.tier] ?? {};
          const isCurrent = p.tier === current;
          const isPaid = p.tier !== 'free';
          const isUpgrade = TIER_ORDER[p.tier] > TIER_ORDER[current];
          return (
            <section key={p.id} className={`bg-white rounded-2xl border-2 p-4 space-y-3 ${TIER_STYLE[p.tier]}`} data-testid={`plan-${p.tier}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-1">
                    {p.tier === 'premium' && <Crown className="w-4 h-4 text-rose-500" />}
                    {p.tier === 'standard' && <Sparkles className="w-4 h-4 text-sky-500" />}
                    {lang === 'ko' ? p.name_ko : p.name_ja}
                  </h2>
                  {p.price_jpy > 0 && <p className="text-lg font-semibold text-gray-800">{priceLabel(p)}</p>}
                </div>
                {isCurrent && <Badge variant="secondary">{t('plans.currentBadge')}</Badge>}
              </div>
              <dl className="text-sm text-gray-700 grid grid-cols-[1fr_auto] gap-y-1.5 gap-x-3">
                <dt>{t('plans.row.likes')}</dt><dd className="text-right font-medium">{fmtLimit(l.likes_per_day, 'plans.perDay')}</dd>
                <dt>{t('plans.row.messages')}</dt><dd className="text-right font-medium">{fmtLimit(l.messages_per_month, 'plans.perMonthShort')}</dd>
                <dt>{t('plans.row.translations')}</dt><dd className="text-right font-medium">{fmtLimit(l.translations_per_day, 'plans.perDay')}</dd>
                <dt>{t('plans.row.footprints')}</dt><dd className="text-right">{f.footprints ? <Yes /> : <No />}</dd>
                <dt>{t('plans.row.priority')}</dt><dd className="text-right">{f.priority ? <Yes /> : <No />}</dd>
                <dt>{t('plans.row.compatibility')}</dt><dd className="text-right">{f.compatibility ? <Yes /> : <No />}</dd>
                <dt>{t('plans.row.polish')}</dt><dd className="text-right">{f.profile_polish ? <Yes /> : <No />}</dd>
                <dt>{t('plans.row.event')}</dt>
                <dd className="text-right text-xs">
                  {f.event_discount_pct ? t('plans.event.discount', { pct: f.event_discount_pct }) : f.event_early_access ? t('plans.event.early') : t('plans.event.none')}
                </dd>
              </dl>
              {isPaid && !isCurrent && (
                <Button className="w-full" disabled={busy !== null} onClick={() => void choose(p.tier)} data-testid={`choose-${p.tier}`}>
                  {busy === p.tier ? t('plans.redirecting') : isUpgrade ? t('plans.choose') : t('plans.change')}
                </Button>
              )}
            </section>
          );
        })}
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">{t('plans.all')}</h2>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>{t('plans.row.search')}</li>
          <li>{t('plans.row.salon')}</li>
          <li>{t('plans.row.verified')}</li>
        </ul>
        <p className="text-xs text-gray-500">{t('plans.verifiedNote')}</p>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">{t('plans.notes.title')}</h2>
        <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
          <li>{t('plans.notes.renew')}</li>
          <li>{t('plans.notes.change')}</li>
          <li>{t('plans.notes.cancel')}</li>
          <li>{t('plans.notes.history')}</li>
          <li>{t('plans.notes.safety')}</li>
          <li>{t('plans.notes.currency')}</li>
        </ul>
        {pub?.stripe_mode !== 'live' && <p className="text-xs text-amber-700">{t('plans.testMode')}</p>}
      </section>
    </div>
  );
};
