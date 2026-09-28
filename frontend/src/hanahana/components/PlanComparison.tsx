import React from 'react';
import { Check, Minus, Crown, Sparkles, Gift } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '../i18n';
import { planFeatures, type Plan, type PlanTier } from '../api/plans';
import type { PublicSettings } from '../api/settings';
import type { MessageKey } from '../i18n/ja';

/**
 * ログイン前 (/app/pricing) とログイン後 (/app/plans) で同じ内容を表示するための共通部品。
 * 数値は app_settings.plan_limits、機能は plans.features を根拠にする (コード固定なし)。
 */

export type Limits = Record<string, { likes_per_day?: number | null; likes_per_month?: number | null; messages_per_month?: number | null; translations_per_day?: number | null }>;

export const TIER_STYLE: Record<PlanTier, string> = {
  free: 'border-gray-200',
  light: 'border-sky-300',
  standard: 'border-rose-400 shadow-md',
};
export const TIER_BADGE: Record<PlanTier, string> = { free: '', light: 'bg-sky-500', standard: 'bg-rose-500' };

export const Yes: React.FC = () => <Check className="w-4 h-4 text-emerald-600 inline" aria-label="yes" />;
export const No: React.FC = () => <Minus className="w-4 h-4 text-gray-300 inline" aria-label="no" />;

export function usePlanFormatters() {
  const { t, lang } = useI18n();
  const fmtLimit = (n: number | null | undefined, unit: MessageKey) =>
    n === null || n === undefined ? t('plans.unlimited') : n === 0 ? t('plans.notAvailable') : `${n}${t(unit)}`;
  const fmtLikes = (l: Limits[string]) => {
    const parts: string[] = [];
    if (l.likes_per_day != null) parts.push(`${l.likes_per_day}${t('plans.perDay')}`);
    if (l.likes_per_month != null) parts.push(`${l.likes_per_month}${t('plans.perMonthShort')}`);
    return parts.length ? parts.join(' / ') : t('plans.unlimited');
  };
  const fmtPhotos = (n: number | null | undefined) => (n === null || n === undefined ? t('plans.unlimited') : t('plans.photos.upTo', { n }));
  const priceLabel = (p: Plan) => `¥${p.price_jpy.toLocaleString(lang === 'ko' ? 'ko-KR' : 'ja-JP')}${t('plans.perMonth')}`;
  const planName = (p: Plan) => (lang === 'ko' ? p.name_ko : p.name_ja);
  return { fmtLimit, fmtLikes, fmtPhotos, priceLabel, planName };
}

export const FemaleFreeNotice: React.FC<{ settings: PublicSettings | null }> = ({ settings }) => {
  const { t } = useI18n();
  if (!settings?.free_full_access_genders.includes('female')) return null;
  return (
    <p className="text-sm text-rose-800 bg-rose-50 border border-rose-100 rounded-xl p-3 flex gap-2" data-testid="female-free">
      <Gift className="w-4 h-4 shrink-0 mt-0.5" />
      {t('plans.femaleFree')}
    </p>
  );
};

interface CardProps {
  plan: Plan;
  limits: Limits[string];
  isCurrent?: boolean;
  /** 申込/変更ボタンなど。null なら表示しない */
  action?: React.ReactNode;
}

export const PlanCard: React.FC<CardProps> = ({ plan: p, limits: l, isCurrent = false, action }) => {
  const { t } = useI18n();
  const { fmtLimit, fmtLikes, fmtPhotos, priceLabel, planName } = usePlanFormatters();
  const f = planFeatures(p);
  return (
    <section className={`bg-white rounded-2xl border-2 p-4 space-y-3 ${TIER_STYLE[p.tier]}`} data-testid={`plan-${p.tier}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-1">
            {p.tier === 'standard' && <Crown className="w-4 h-4 text-rose-500" />}
            {p.tier === 'light' && <Sparkles className="w-4 h-4 text-sky-500" />}
            {planName(p)}
          </h3>
          <p className="text-lg font-semibold text-gray-800">{p.price_jpy > 0 ? priceLabel(p) : `¥0${t('plans.perMonth')}`}</p>
        </div>
        {isCurrent && <Badge variant="secondary">{t('plans.currentBadge')}</Badge>}
      </div>
      <dl className="text-sm text-gray-700 grid grid-cols-[1fr_auto] gap-y-1.5 gap-x-3">
        <dt>{t('plans.row.search')}</dt><dd className="text-right"><Yes /></dd>
        <dt>{t('plans.row.likes')}</dt><dd className="text-right font-medium">{fmtLikes(l)}</dd>
        <dt>{t('plans.row.messages')}</dt><dd className="text-right font-medium">{fmtLimit(l.messages_per_month, 'plans.perMonthShort')}</dd>
        <dt>{t('plans.row.translations')}</dt><dd className="text-right font-medium">{fmtLimit(l.translations_per_day, 'plans.perDay')}</dd>
        <dt>{t('plans.row.photos')}</dt><dd className="text-right font-medium">{fmtPhotos(f.photo_view_max)}</dd>
        <dt>{t('plans.row.verifiedSearch')}</dt><dd className="text-right">{f.verified_search ? <Yes /> : <No />}</dd>
        <dt>{t('plans.row.footprints')}</dt><dd className="text-right">{f.footprints ? <Yes /> : <No />}</dd>
        <dt>{t('plans.row.priority')}</dt><dd className="text-right">{f.priority ? <Yes /> : <No />}</dd>
        <dt>{t('plans.row.compatibility')}</dt><dd className="text-right">{f.compatibility ? <Yes /> : <No />}</dd>
        <dt>{t('plans.row.polish')}</dt><dd className="text-right">{f.profile_polish ? <Yes /> : <No />}</dd>
        <dt>{t('plans.row.salon')}</dt><dd className="text-right"><Yes /></dd>
        <dt>{t('plans.row.event')}</dt>
        <dd className="text-right text-xs">
          {f.event_discount_pct ? t('plans.event.discount', { pct: f.event_discount_pct }) : f.event_early_access ? t('plans.event.early') : t('plans.event.none')}
        </dd>
      </dl>
      {action}
    </section>
  );
};

/** 全プラン共通 (安全機能・本人確認は審査結果のみ) */
export const PlanCommonSection: React.FC = () => {
  const { t } = useI18n();
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-800">{t('plans.all')}</h2>
      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
        <li>{t('plans.row.search')}</li>
        <li>{t('plans.row.salon')}</li>
        <li>{t('plans.row.matching')}</li>
        <li>{t('plans.row.safety')}</li>
        <li>{t('plans.row.verified')}</li>
      </ul>
      <p className="text-xs text-gray-500">{t('plans.verifiedNote')}</p>
    </section>
  );
};

/** 料金表の下の詳細条件。実装済みの運用 (Stripe Checkout/Portal) を根拠に記載し、未確定は管理者確認項目として明示 */
export const PlanTermsSection: React.FC<{ settings: PublicSettings | null; limits: Limits; plans: Plan[] }> = ({ settings, limits, plans }) => {
  const { t } = useI18n();
  const { fmtLimit, fmtLikes, fmtPhotos, planName } = usePlanFormatters();
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-800">{t('plans.notes.title')}</h2>
      {plans.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="text-xs text-gray-700 w-full min-w-[320px]">
            <caption className="sr-only">{t('plans.terms.limitsCaption')}</caption>
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-2 font-medium">{t('plans.terms.limitsCaption')}</th>
                {plans.map((p) => <th key={p.id} className="py-1 px-1 font-medium text-right">{planName(p)}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr><td className="py-1 pr-2">{t('plans.row.likes')}</td>{plans.map((p) => <td key={p.id} className="py-1 px-1 text-right">{fmtLikes(limits[p.tier] ?? {})}</td>)}</tr>
              <tr><td className="py-1 pr-2">{t('plans.row.messages')}</td>{plans.map((p) => <td key={p.id} className="py-1 px-1 text-right">{fmtLimit(limits[p.tier]?.messages_per_month, 'plans.perMonthShort')}</td>)}</tr>
              <tr><td className="py-1 pr-2">{t('plans.row.translations')}</td>{plans.map((p) => <td key={p.id} className="py-1 px-1 text-right">{fmtLimit(limits[p.tier]?.translations_per_day, 'plans.perDay')}</td>)}</tr>
              <tr><td className="py-1 pr-2">{t('plans.row.photos')}</td>{plans.map((p) => <td key={p.id} className="py-1 px-1 text-right">{fmtPhotos(planFeatures(p).photo_view_max)}</td>)}</tr>
            </tbody>
          </table>
          {settings && <p className="text-[11px] text-gray-500 mt-1">{t('plans.terms.rateLimit', { n: settings.message_rate_per_minute })}</p>}
        </div>
      )}
      <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
        <li>{t('plans.notes.start')}</li>
        <li>{t('plans.notes.renew')}</li>
        <li>{t('plans.notes.change')}</li>
        <li>{t('plans.notes.cancel')}</li>
        <li>{t('plans.notes.afterCancel')}</li>
        <li>{t('plans.notes.failed', { days: settings?.past_due_grace_days ?? 7 })}</li>
        <li>{t('plans.notes.events')}</li>
        <li>{t('plans.notes.history')}</li>
        <li>{t('plans.notes.currency')}</li>
        <li>{t('plans.notes.points')}</li>
      </ul>
      <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2" data-testid="refund-pending">{t('plans.notes.refundPending')}</p>
      {settings?.stripe_mode !== 'live' && <p className="text-xs text-amber-700">{t('plans.testMode')}</p>}
    </section>
  );
};
