import React, { useEffect, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { fetchCompatibility, type Compatibility } from '../api/premium';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/ja';
import PremiumLock from './PremiumLock';

const BREAKDOWN: { key: 'purpose' | 'language' | 'interest' | 'preference'; label: MessageKey; max: number }[] = [
  { key: 'purpose', label: 'compat.purpose', max: 30 },
  { key: 'language', label: 'compat.language', max: 30 },
  { key: 'interest', label: 'compat.interest', max: 20 },
  { key: 'preference', label: 'compat.preference', max: 20 },
];

const CompatibilityCard: React.FC<{ targetUserId: string }> = ({ targetUserId }) => {
  const { t } = useI18n();
  const [data, setData] = useState<Compatibility | null | undefined>(undefined);

  useEffect(() => {
    setData(undefined);
    fetchCompatibility(targetUserId).then(setData).catch(() => setData(null));
  }, [targetUserId]);

  if (data === undefined || data === null) return null;

  return (
    <section className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3 space-y-2" data-testid="compatibility">
      <h2 className="text-sm font-bold text-rose-700 flex items-center gap-1.5"><HeartHandshake className="w-4 h-4" />{t('compat.title')}</h2>
      {!data.unlocked ? (
        <PremiumLock lead={t('compat.locked')} />
      ) : (
        <>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-rose-600 leading-none">{data.score}</span>
            <span className="text-xs text-gray-500 pb-0.5">/ 100 · {t('compat.score')}</span>
          </div>
          <ul className="space-y-1">
            {BREAKDOWN.map(({ key, label, max }) => (
              <li key={key} className="text-xs">
                <div className="flex justify-between text-gray-600"><span>{t(label)}</span><span>{data.breakdown[key]}/{max}</span></div>
                <div className="h-1.5 rounded bg-rose-100 overflow-hidden">
                  <div className="h-full bg-rose-400" style={{ width: `${Math.round((data.breakdown[key] / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {data.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.reasons.map((r) => (
                <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-rose-200 text-rose-700">
                  {t(`reason.${r}` as MessageKey)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default CompatibilityCard;
