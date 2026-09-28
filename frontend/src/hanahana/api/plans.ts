import { getSupabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type { MessageKey } from '../i18n/ja';

type Tables = Database['public']['Tables'];
export type Plan = Tables['plans']['Row'];
export type PlanTier = Database['public']['Enums']['plan_tier_t'];

export interface PlanFeatures {
  footprints?: boolean;
  priority?: boolean;
  compatibility?: boolean;
  profile_polish?: boolean;
  event_discount_pct?: number;
  event_early_access?: boolean;
  verified_search?: boolean;
  /** 相手の写真を何枚まで閲覧できるか (null/未設定 = 無制限。マッチ済み相手は常に全枚) */
  photo_view_max?: number | null;
}

export interface PlanUsage {
  /** 実際に適用される段階 (女性など免除対象は最上位) */
  tier: PlanTier;
  /** 契約上の段階 */
  subscribed_tier: PlanTier;
  exempt: boolean;
  likes_today: number;
  likes_per_day: number | null;
  likes_month: number;
  likes_per_month: number | null;
  messages_month: number;
  messages_per_month: number | null;
  translations_today: number;
  translations_per_day: number | null;
  subscription: {
    status: Database['public']['Enums']['subscription_status_t'];
    plan_tier: PlanTier | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    latest_invoice_status: string | null;
  } | null;
}

export const TIER_KEY: Record<PlanTier, MessageKey> = {
  free: 'my.tier.free',
  light: 'plans.tier.light',
  standard: 'plans.tier.standard',
};

export const TIER_ORDER: Record<PlanTier, number> = { free: 0, light: 1, standard: 2 };
export type PaidTier = Exclude<PlanTier, 'free'>;
export const PAID_TIERS: PaidTier[] = ['light', 'standard'];
export const TOP_TIER: PlanTier = 'standard';

export function planFeatures(p: Plan): PlanFeatures {
  return (p.features ?? {}) as PlanFeatures;
}

export async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await getSupabase()
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

/** ログイン前でも取得できる有効プラン (public_plans RPC) */
export async function fetchPublicPlans(): Promise<Plan[]> {
  const { data, error } = await getSupabase().rpc('public_plans');
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyPlanUsage(): Promise<PlanUsage> {
  const { data, error } = await getSupabase().rpc('my_plan_usage');
  if (error) throw error;
  return data as unknown as PlanUsage;
}

export type PlanLimitKind = 'like' | 'like_month' | 'message' | 'message_none' | 'message_rate' | 'translation' | 'feature';

/** サーバー側 (トリガー / Edge Function) の上限エラーを判別する */
export function planLimitKind(e: unknown): PlanLimitKind | null {
  const msg =
    e instanceof Error ? e.message
    : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message)
    : String(e);
  const detail = errorDetail(e);
  if (/like_limit_reached/.test(msg)) return /"period"\s*:\s*"month"/.test(detail) ? 'like_month' : 'like';
  if (/message_limit_reached/.test(msg)) return /"limit"\s*:\s*0\b/.test(detail) ? 'message_none' : 'message';
  if (/message_rate_limited/.test(msg)) return 'message_rate';
  if (/daily_limit/.test(msg)) return 'translation';
  if (/plan_feature_required|premium_required/.test(msg)) return 'feature';
  return null;
}

/** PostgREST が返すエラーの details/detail 文字列 */
export function errorDetail(e: unknown): string {
  if (!e || typeof e !== 'object') return '';
  if ('details' in e && typeof (e as { details: unknown }).details === 'string') return (e as { details: string }).details;
  if ('detail' in e) return JSON.stringify((e as { detail: unknown }).detail);
  return '';
}

export function remaining(used: number, limit: number | null): number | null {
  return limit === null ? null : Math.max(0, limit - used);
}
