import React from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useI18n } from '../i18n';

/** プレミアム限定機能のロック表示 + /app/plans への導線 */
const PremiumLock: React.FC<{ lead?: string; className?: string }> = ({ lead, className }) => {
  const { t } = useI18n();
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 ${className ?? ''}`} role="status">
      <p className="font-semibold flex items-center gap-1.5"><Crown className="w-4 h-4 text-amber-600" />{t('premium.lockedTitle')}</p>
      <p className="mt-1 text-amber-800">{lead ?? t('premium.lockedLead')}</p>
      <Link to="/app/plans" className="inline-block mt-2 font-semibold text-rose-700 underline">{t('premium.viewPlans')}</Link>
    </div>
  );
};

export default PremiumLock;
