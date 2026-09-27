import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AccountStatus, ReportStatus, VerificationStatus } from '../api/admin';
import { REPORT_STATUS_LABELS, STATUS_LABELS, VERIFICATION_LABELS } from './labels';

const STATUS_COLORS: Record<AccountStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-amber-100 text-amber-800',
  banned: 'bg-red-100 text-red-800',
  deleted: 'bg-gray-200 text-gray-700',
};

export const StatusBadge: React.FC<{ status: AccountStatus }> = ({ status }) => (
  <Badge variant="outline" className={`border-0 ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</Badge>
);

const VERIFICATION_COLORS: Record<VerificationStatus, string> = {
  unverified: 'bg-gray-100 text-gray-600',
  pending: 'bg-blue-100 text-blue-800',
  verified: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

export const VerificationBadge: React.FC<{ status: VerificationStatus | null }> = ({ status }) => {
  const s = status ?? 'unverified';
  return <Badge variant="outline" className={`border-0 ${VERIFICATION_COLORS[s]}`}>{VERIFICATION_LABELS[s]}</Badge>;
};

const REPORT_COLORS: Record<ReportStatus, string> = {
  open: 'bg-red-100 text-red-800',
  in_review: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  dismissed: 'bg-gray-200 text-gray-700',
};

export const ReportStatusBadge: React.FC<{ status: ReportStatus }> = ({ status }) => (
  <Badge variant="outline" className={`border-0 ${REPORT_COLORS[status]}`}>{REPORT_STATUS_LABELS[status]}</Badge>
);

export const PageHeader: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
    <h1 className="text-xl font-bold">{title}</h1>
    <div className="flex gap-2">{children}</div>
  </div>
);

export const Pager: React.FC<{ page: number; size: number; total: number; onChange: (p: number) => void }> = ({ page, size, total, onChange }) => {
  const last = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex items-center justify-between text-sm text-gray-600 mt-3">
      <span>{total} 件</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>前へ</Button>
        <span>{page} / {last}</span>
        <Button size="sm" variant="outline" disabled={page >= last} onClick={() => onChange(page + 1)}>次へ</Button>
      </div>
    </div>
  );
};

export const Empty: React.FC<{ text?: string }> = ({ text = 'データがありません' }) => (
  <p className="text-center text-gray-500 py-10 text-sm">{text}</p>
);
