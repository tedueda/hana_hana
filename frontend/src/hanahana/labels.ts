import type { Country, Gender, LanguageLevel, MeetingPref, Nationality, ReportReason } from './types';
import { translate, type Lang } from './i18n';
import type { MessageKey } from './i18n/ja';

export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) || 'Hana-Hana';

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
  'spam',
  'solicitation',
  'personal_info',
  'other',
];

const REASON_KEYS = [
  'gender', 'gender_mutual', 'nationality', 'age', 'language', 'language_exchange', 'interest',
  'shared_interests', 'purpose', 'shared_purpose', 'region', 'nearby', 'country', 'meeting_pref',
  'recent', 'verified', 'priority',
] as const;

function mapOf<K extends string>(lang: Lang, prefix: string, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, translate(lang, `${prefix}.${k}` as MessageKey)])) as Record<K, string>;
}

export interface Labels {
  gender: Record<Gender, string>;
  nationality: Record<Nationality, string>;
  country: Record<Country, string>;
  level: Record<LanguageLevel, string>;
  meetingPref: Record<MeetingPref, string>;
  reportReason: Record<ReportReason, string>;
  reason: Record<string, string>;
}

export function labelsFor(lang: Lang): Labels {
  const nationality = mapOf(lang, 'nat', NATIONALITIES);
  return {
    gender: mapOf(lang, 'gender', GENDERS),
    nationality,
    country: nationality,
    level: mapOf(lang, 'level', [...LEVELS, 'native'] as LanguageLevel[]),
    meetingPref: mapOf(lang, 'meeting', MEETING_PREFS),
    reportReason: mapOf(lang, 'report', REPORT_REASONS),
    reason: mapOf(lang, 'reason', REASON_KEYS),
  };
}

const JA = labelsFor('ja');
/** @deprecated 表示言語に依存しない箇所のみ。画面では useLabels() を使う */
export const GENDER_LABELS = JA.gender;
export const NATIONALITY_LABELS = JA.nationality;
export const COUNTRY_LABELS = JA.country;
export const LEVEL_LABELS = JA.level;
export const MEETING_PREF_LABELS = JA.meetingPref;
export const REPORT_REASON_LABELS = JA.reportReason;
export const REASON_LABELS = JA.reason;

/** Error / PostgrestError / 文字列 のいずれでも人が読めるメッセージにする */
export function errorMessage(e: unknown, lang: Lang = 'ja'): string {
  const raw = rawMessage(e);
  if (/row-level security|permission denied|42501/i.test(raw)) return translate(lang, 'common.forbidden');
  if (/Failed to fetch|NetworkError/i.test(raw)) return translate(lang, 'common.networkError');
  if (/Invalid login credentials/i.test(raw)) return translate(lang, 'auth.err.invalid');
  if (/Email not confirmed/i.test(raw)) return translate(lang, 'auth.err.notConfirmed');
  if (/already registered|already been registered/i.test(raw)) return translate(lang, 'auth.err.exists');
  if (/Password should be at least/i.test(raw)) return translate(lang, 'auth.err.password');
  if (/rate limit/i.test(raw)) return translate(lang, 'auth.err.rateLimit');
  return raw;
}

function rawMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return String(e);
}
