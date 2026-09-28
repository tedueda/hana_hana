import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useI18n } from '../i18n';
import { planLimitKind, type PlanLimitKind } from '../api/plans';
import type { MessageKey } from '../i18n/ja';

const KEY: Record<PlanLimitKind, MessageKey> = {
  like: 'plans.limit.like',
  message: 'plans.limit.message',
  message_rate: 'plans.limit.messageRate',
  translation: 'plans.limit.translation',
};

function limitFromError(e: unknown): number | string {
  const d =
    e && typeof e === 'object' && 'details' in e && typeof (e as { details: unknown }).details === 'string'
      ? (e as { details: string }).details
      : e && typeof e === 'object' && 'detail' in e
        ? JSON.stringify((e as { detail: unknown }).detail)
        : '';
  const m = /"limit"\s*:\s*(\d+)|"per_day"\s*:\s*(\d+)/.exec(d);
  return m ? Number(m[1] ?? m[2]) : '';
}

/** 上限エラーなら日韓の案内文を返す (それ以外は null) */
export function usePlanLimitText(): (e: unknown) => { kind: PlanLimitKind; text: string } | null {
  const { t } = useI18n();
  return useCallback(
    (e: unknown) => {
      const kind = planLimitKind(e);
      if (!kind) return null;
      return { kind, text: t(KEY[kind], { n: limitFromError(e) }) };
    },
    [t],
  );
}

export const PlanLimitNotice: React.FC<{ text: string; showUpgrade?: boolean; className?: string }> = ({ text, showUpgrade = true, className }) => {
  const { t } = useI18n();
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-center gap-2 ${className ?? ''}`} role="status">
      <Crown className="w-4 h-4 shrink-0 text-amber-600" />
      <span className="flex-1">{text}</span>
      {showUpgrade && (
        <Link to="/app/plans" className="shrink-0 font-semibold text-rose-700 underline">
          {t('plans.limit.upgrade')}
        </Link>
      )}
    </div>
  );
};
