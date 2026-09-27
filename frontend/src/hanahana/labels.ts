import type { Country, Gender, LanguageLevel, MeetingPref, Nationality, ReportReason } from './types';

export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) || 'Hana-Hana';

export const GENDER_LABELS: Record<Gender, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
  undisclosed: '回答しない',
};

export const NATIONALITY_LABELS: Record<Nationality, string> = {
  JP: '日本',
  KR: '韓国',
  other: 'その他',
};

export const COUNTRY_LABELS: Record<Country, string> = NATIONALITY_LABELS;

export const LEVEL_LABELS: Record<LanguageLevel, string> = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  native: 'ネイティブ',
};

export const MEETING_PREF_LABELS: Record<MeetingPref, string> = {
  online_only: 'オンラインのみ',
  online_first: 'まずはオンライン',
  meet_ok: '実際に会うのもOK',
  travel_meet: '旅行時に会いたい',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  inappropriate_content: '不適切な内容',
  impersonation: 'なりすまし',
  harassment: '迷惑行為',
  fraud_suspected: '詐欺の疑い',
  inappropriate_photo: '不適切な写真',
  other: 'その他',
};

export const REASON_LABELS: Record<string, string> = {
  gender: '希望の性別',
  gender_mutual: 'お互いの希望が一致',
  nationality: '希望の国籍',
  age: '希望の年齢',
  language: '言語交換が成立',
  interest: '共通の趣味',
  purpose: '同じ利用目的',
  region: '同じ地域',
  country: '同じ国',
  meeting_pref: '交流スタイルが近い',
  recent: '最近アクティブ',
  verified: '本人確認済み',
};

export const LEVELS: LanguageLevel[] = ['beginner', 'intermediate', 'advanced'];
export const GENDERS: Gender[] = ['male', 'female', 'other', 'undisclosed'];
export const NATIONALITIES: Nationality[] = ['JP', 'KR', 'other'];
export const MEETING_PREFS: MeetingPref[] = ['online_only', 'online_first', 'meet_ok', 'travel_meet'];
export const REPORT_REASONS: ReportReason[] = [
  'inappropriate_content',
  'impersonation',
  'harassment',
  'fraud_suspected',
  'inappropriate_photo',
  'other',
];

/** Error / PostgrestError / 文字列 のいずれでも人が読めるメッセージにする */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return String(e);
}
