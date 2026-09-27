import type { AccountStatus, ReportStatus, VerificationStatus } from '../api/admin';

export const STATUS_LABELS: Record<AccountStatus, string> = {
  active: '有効',
  suspended: '利用停止',
  banned: 'BAN',
  deleted: '退会',
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: '未申請',
  pending: '審査待ち',
  verified: '確認済み',
  rejected: '却下',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: '未対応',
  in_review: '対応中',
  resolved: '解決',
  dismissed: '却下',
};

export const fmtDate = (v: string | null | undefined): string => (v ? new Date(v).toLocaleString('ja-JP') : '-');

export const ageOf = (birthdate: string | null | undefined): string => {
  if (!birthdate) return '-';
  const b = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return String(age);
};

export { errorMessage } from '../labels';
