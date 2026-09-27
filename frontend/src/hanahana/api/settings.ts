import { getSupabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/supabase';

type Tables = Database['public']['Tables'];
type Fn = Database['public']['Functions'];

export type UserSettings = Tables['user_settings']['Row'];
export type UserSettingsUpdate = Omit<Tables['user_settings']['Update'], 'user_id' | 'updated_at'>;
export type BlockedUser = Fn['my_blocks']['Returns'][number];
export type ConsentStatus = Fn['my_consent_status']['Returns'][number];
export type ConversationSummary = Fn['my_conversations']['Returns'][number];
export type ConsentKind = 'terms' | 'privacy' | 'age';

export interface TranslationLimits {
  max_chars: number;
  per_minute: number;
  per_day: number;
}

/** app_settings のうち利用者へ公開してよいキー (public_settings RPC) */
export interface PublicSettings {
  terms_version: string;
  privacy_version: string;
  min_age: number;
  photo_required: boolean;
  photo_grace_until: string | null;
  verification_provider: string;
  verification_doc_retention_days: number;
  translation_enabled: boolean;
  translation_auto_enabled: boolean;
  translation_limits: TranslationLimits;
  require_verification_for_like: boolean;
  max_profile_photos: number;
  account_purge_days: number;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  terms_version: '2026-09-27',
  privacy_version: '2026-09-27',
  min_age: 18,
  photo_required: true,
  photo_grace_until: null,
  verification_provider: 'manual',
  verification_doc_retention_days: 90,
  translation_enabled: true,
  translation_auto_enabled: false,
  translation_limits: { max_chars: 1000, per_minute: 10, per_day: 200 },
  require_verification_for_like: false,
  max_profile_photos: 5,
  account_purge_days: 30,
};

function asRecord(j: Json): Record<string, Json> {
  return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, Json>) : {};
}

export function parsePublicSettings(j: Json): PublicSettings {
  const r = asRecord(j);
  const str = (k: keyof PublicSettings, d: string): string => (typeof r[k] === 'string' ? (r[k] as string) : d);
  const num = (k: keyof PublicSettings, d: number): number => (typeof r[k] === 'number' ? (r[k] as number) : d);
  const bool = (k: keyof PublicSettings, d: boolean): boolean => (typeof r[k] === 'boolean' ? (r[k] as boolean) : d);
  const lim = asRecord(r.translation_limits ?? null);
  const dl = DEFAULT_PUBLIC_SETTINGS.translation_limits;
  return {
    terms_version: str('terms_version', DEFAULT_PUBLIC_SETTINGS.terms_version),
    privacy_version: str('privacy_version', DEFAULT_PUBLIC_SETTINGS.privacy_version),
    min_age: num('min_age', DEFAULT_PUBLIC_SETTINGS.min_age),
    photo_required: bool('photo_required', DEFAULT_PUBLIC_SETTINGS.photo_required),
    photo_grace_until: typeof r.photo_grace_until === 'string' ? r.photo_grace_until : null,
    verification_provider: str('verification_provider', DEFAULT_PUBLIC_SETTINGS.verification_provider),
    verification_doc_retention_days: num('verification_doc_retention_days', DEFAULT_PUBLIC_SETTINGS.verification_doc_retention_days),
    translation_enabled: bool('translation_enabled', DEFAULT_PUBLIC_SETTINGS.translation_enabled),
    translation_auto_enabled: bool('translation_auto_enabled', DEFAULT_PUBLIC_SETTINGS.translation_auto_enabled),
    translation_limits: {
      max_chars: typeof lim.max_chars === 'number' ? lim.max_chars : dl.max_chars,
      per_minute: typeof lim.per_minute === 'number' ? lim.per_minute : dl.per_minute,
      per_day: typeof lim.per_day === 'number' ? lim.per_day : dl.per_day,
    },
    require_verification_for_like: bool('require_verification_for_like', DEFAULT_PUBLIC_SETTINGS.require_verification_for_like),
    max_profile_photos: num('max_profile_photos', DEFAULT_PUBLIC_SETTINGS.max_profile_photos),
    account_purge_days: num('account_purge_days', DEFAULT_PUBLIC_SETTINGS.account_purge_days),
  };
}

let settingsCache: Promise<PublicSettings> | null = null;

export function fetchPublicSettings(force = false): Promise<PublicSettings> {
  if (!settingsCache || force) {
    settingsCache = (async () => {
      try {
        const { data, error } = await getSupabase().rpc('public_settings');
        if (error) throw error;
        return parsePublicSettings(data);
      } catch (e) {
        settingsCache = null;
        throw e;
      }
    })();
  }
  return settingsCache;
}

export async function fetchMySettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await getSupabase().from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertMySettings(userId: string, patch: UserSettingsUpdate): Promise<UserSettings> {
  const { data, error } = await getSupabase()
    .from('user_settings')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function recordConsent(kinds: ConsentKind[], uiLang: string): Promise<void> {
  const { error } = await getSupabase().rpc('record_consent', { p_kinds: kinds, p_ui_lang: uiLang });
  if (error) throw error;
}

export async function fetchConsentStatus(): Promise<ConsentStatus[]> {
  const { data, error } = await getSupabase().rpc('my_consent_status');
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyBlocks(): Promise<BlockedUser[]> {
  const { data, error } = await getSupabase().rpc('my_blocks');
  if (error) throw error;
  return data ?? [];
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await getSupabase().from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
  if (error) throw error;
}

export async function fetchMyConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await getSupabase().rpc('my_conversations');
  if (error) throw error;
  return data ?? [];
}

export async function requestAccountDeletion(): Promise<void> {
  const { error } = await getSupabase().rpc('request_account_deletion');
  if (error) throw error;
}
