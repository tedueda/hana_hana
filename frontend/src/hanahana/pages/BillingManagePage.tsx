import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CreditCard, ExternalLink, RefreshCw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, useI18n } from '../i18n';
import { useErrorMessage } from '../hooks';
import { TIER_KEY } from '../api/plans';
import { BillingError, fetchMyBilling, openPortal, startCheckout, type Billing } from '../api/billing';
import { PageHeader } from './SettingsPage';
import type { MessageKey } from '../i18n/ja';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500',
  trialing: 'bg-sky-500',
  past_due: 'bg-amber-500',
  canceled: 'bg-gray-400',
  incomplete: 'bg-gray-400',
};

const PAY_STYLE: Record<string, string> = {
  paid: 'text-emerald-700',
  failed: 'text-red-600',
  refunded: 'text-gray-500',
  partially_refunded: 'text-amber-700',
};

export const BillingManagePage: React.FC = () => {
  const { t, lang } = useI18n();
  const errMsg = useErrorMessage();
  const [params] = useSearchParams();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBilling(await fetchMyBilling());
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [errMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  // Webhook 反映待ち: 決済直後は数回リロード
  useEffect(() => {
    if (!params.get('checkout') && !params.get('changed')) return;
    const timers = [3000, 8000].map((ms) => window.setTimeout(() => void load(), ms));
    return () => timers.forEach(clearTimeout);
  }, [params, load]);

  const go = async (fn: () => Promise<{ url: string }>) => {
    setBusy(true);
    setError('');
    try {
      const { url } = await fn();
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof BillingError ? t(`billing.err.${e.code}` as MessageKey) : errMsg(e));
      setBusy(false);
    }
  };

  const sub = billing?.subscription ?? null;
  const locale = lang === 'ko' ? 'ko-KR' : 'ja-JP';
  const fmt = (d: string | null) => (d ? formatDate(d, locale, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
  const yen = (n: number) => `¥${n.toLocaleString(locale)}`;

  return (
    <div className="space-y-4">
      <PageHeader title={t('billing.title')} back="/app/plans" />
      <p className="text-sm text-gray-700">{t('billing.lead')}</p>
      {params.get('checkout') === 'success' && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3">{t('billing.success')}</p>}
      {params.get('changed') && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3">{t('billing.changed')}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {billing && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3" data-testid="billing-current">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{t('plans.current')}</h2>
            <Badge className={billing.tier === 'premium' ? 'bg-rose-500' : billing.tier === 'standard' ? 'bg-sky-500' : 'bg-gray-400'}>
              {t(TIER_KEY[billing.tier])}
            </Badge>
          </div>

          {!sub || !sub.is_stripe ? (
            <>
              <p className="text-sm text-gray-600">{t('billing.noSubscription')}</p>
              <Button asChild className="w-full"><Link to="/app/plans">{t('billing.viewPlans')}</Link></Button>
            </>
          ) : (
            <>
              <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-gray-500">{t('billing.status')}</dt>
                <dd>
                  <Badge className={STATUS_STYLE[sub.status] ?? 'bg-gray-400'}>{t(`billing.status.${sub.status}` as MessageKey)}</Badge>
                </dd>
                <dt className="text-gray-500">{sub.cancel_at_period_end ? t('billing.endsAt') : t('billing.nextRenewal')}</dt>
                <dd data-testid="period-end">{fmt(sub.current_period_end)}</dd>
                <dt className="text-gray-500">{t(TIER_KEY[sub.plan_tier ?? 'free'])}</dt>
                <dd>{yen(sub.price_jpy)}{t('plans.perMonth')}</dd>
              </dl>

              {sub.status === 'past_due' && (
                <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {t('billing.pastDue')}
                </p>
              )}
              {sub.cancel_at_period_end && sub.status !== 'canceled' && (
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{t('billing.cancelScheduled')}</p>
              )}

              <div className="grid grid-cols-1 gap-2 pt-1">
                {sub.status !== 'canceled' && (
                  <Button variant="outline" disabled={busy} onClick={() => void go(() => startCheckout(sub.plan_tier === 'premium' ? 'standard' : 'premium'))} data-testid="btn-change">
                    {t('billing.changePlan')}: {t(TIER_KEY[sub.plan_tier === 'premium' ? 'standard' : 'premium'])}
                  </Button>
                )}
                <Button variant="outline" disabled={busy} onClick={() => void go(() => openPortal('payment_method'))} data-testid="btn-card">
                  <CreditCard className="w-4 h-4 mr-1" />{t('billing.updateCard')}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void go(() => openPortal())} data-testid="btn-portal">
                  <ExternalLink className="w-4 h-4 mr-1" />{sub.cancel_at_period_end ? t('billing.resume') : t('billing.portal')}
                </Button>
                {!sub.cancel_at_period_end && sub.status !== 'canceled' && (
                  <Button variant="ghost" className="text-red-600" disabled={busy} onClick={() => void go(() => openPortal('cancel'))} data-testid="btn-cancel">
                    <XCircle className="w-4 h-4 mr-1" />{t('billing.cancel')}
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {billing && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2" data-testid="billing-payments">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{t('billing.payments')}</h2>
            <Button variant="ghost" size="sm" disabled={loading} onClick={() => void load()} aria-label={t('billing.refresh')}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {billing.payments.length === 0 ? (
            <p className="text-sm text-gray-500">{t('billing.noPayments')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {billing.payments.map((p) => (
                <li key={p.id} className="py-2 text-sm flex items-start justify-between gap-2">
                  <div>
                    <div>{fmt(p.paid_at ?? p.created_at)}</div>
                    {p.failure_message && <div className="text-xs text-red-600">{p.failure_message}</div>}
                    {p.refunded_amount > 0 && <div className="text-xs text-gray-500">{t('billing.refundedAmount', { n: p.refunded_amount.toLocaleString(locale) })}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{yen(p.amount)}</div>
                    <div className={`text-xs ${PAY_STYLE[p.status] ?? 'text-gray-500'}`}>{t(`billing.pay.${p.status}` as MessageKey)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
