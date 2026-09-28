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
}

export interface PlanUsage {
  tier: PlanTier;
  likes_today: number;
  likes_per_day: number | null;
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
  standard: 'plans.tier.standard',
  premium: 'plans.tier.premium',
};

export const TIER_ORDER: Record<PlanTier, number> = { free: 0, standard: 1, premium: 2 };

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

export async function fetchMyPlanUsage(): Promise<PlanUsage> {
  const { data, error } = await getSupabase().rpc('my_plan_usage');
  if (error) throw error;
  return data as unknown as PlanUsage;
}

export type PlanLimitKind = 'like' | 'message' | 'message_rate' | 'translation';

/** サーバー側 (トリガー / Edge Function) の上限エラーを判別する */
export function planLimitKind(e: unknown): PlanLimitKind | null {
  const msg =
    e instanceof Error ? e.message
    : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message)
    : String(e);
  if (/like_limit_reached/.test(msg)) return 'like';
  if (/message_limit_reached/.test(msg)) return 'message';
  if (/message_rate_limited/.test(msg)) return 'message_rate';
  if (/daily_limit/.test(msg)) return 'translation';
  return null;
}

export function remaining(used: number, limit: number | null): number | null {
  return limit === null ? null : Math.max(0, limit - used);
}
