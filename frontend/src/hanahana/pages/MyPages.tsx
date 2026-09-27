import React, { useEffect, useState } from 'react';
import { BadgeCheck, Clock, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '../i18n';
import { fetchMyVerification, type Verification } from '../api/profile';
import { PageHeader } from './SettingsPage';
import type { MessageKey } from '../i18n/ja';

const STATUS: Record<Verification['status'], { key: MessageKey; icon: React.ElementType; cls: string }> = {
  unverified: { key: 'my.verify.unverified', icon: ShieldQuestion, cls: 'text-gray-500' },
  pending: { key: 'my.verify.pending', icon: Clock, cls: 'text-amber-600' },
  verified: { key: 'my.verify.verified', icon: BadgeCheck, cls: 'text-sky-600' },
  rejected: { key: 'my.verify.rejected', icon: ShieldAlert, cls: 'text-red-600' },
};

export const VerificationPage: React.FC = () => {
  const { t } = useI18n();
  const [v, setV] = useState<Verification | null | undefined>(undefined);
  useEffect(() => {
    fetchMyVerification().then(setV).catch(() => setV(null));
  }, []);

  const status = v?.status ?? 'unverified';
  const { key, icon: Icon, cls } = STATUS[status];

  return (
    <div className="space-y-4">
      <PageHeader title={t('verification.title')} back="/app/profile" />
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <p className="text-sm text-gray-700">{t('verification.lead')}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('verification.status')}</span>
          {v === undefined ? (
            <span className="text-sm text-gray-400">{t('common.loading')}</span>
          ) : (
            <span className={`flex items-center gap-1.5 font-medium ${cls}`}>
              <Icon className="w-5 h-5" aria-hidden />
              {t(key)}
            </span>
          )}
        </div>
        {status === 'rejected' && v?.rejected_reason && (
          <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{t('verification.rejectedReason', { reason: v.rejected_reason })}</p>
        )}
        {status !== 'verified' && status !== 'pending' && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">{t('verification.comingSoon')}</p>
        )}
      </div>
    </div>
  );
};

export const PlusPage: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <PageHeader title={t('my.plus')} back="/app/profile" />
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <Badge variant="secondary">{t('my.tier.free')}</Badge>
        <p className="text-sm text-gray-700">{t('my.plusLead')}</p>
      </div>
    </div>
  );
};
