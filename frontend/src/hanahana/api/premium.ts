import { getSupabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/supabase';
import type { PlanTier } from './plans';

type Fn = Database['public']['Functions'];

export interface PlanFeaturesMe {
  tier: PlanTier;
  footprints?: boolean;
  priority?: boolean;
  compatibility?: boolean;
  profile_polish?: boolean;
  event_discount_pct?: number;
  event_early_access?: boolean;
}

export async function fetchMyPlanFeatures(): Promise<PlanFeaturesMe> {
  const { data, error } = await getSupabase().rpc('my_plan_features');
  if (error) throw error;
  return data as unknown as PlanFeaturesMe;
}

export async function recordProfileView(targetUserId: string): Promise<void> {
  await getSupabase().rpc('record_profile_view', { p_target: targetUserId });
}

export interface FootprintsSummary {
  unlocked: boolean;
  days: number;
  viewer_count: number;
}

export async function fetchFootprintsSummary(): Promise<FootprintsSummary> {
  const { data, error } = await getSupabase().rpc('my_footprints_summary');
  if (error) throw error;
  return data as unknown as FootprintsSummary;
}

export type Footprint = Fn['my_footprints']['Returns'][number];

export async function fetchFootprints(limit = 50): Promise<Footprint[]> {
  const { data, error } = await getSupabase().rpc('my_footprints', { p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

export type Compatibility =
  | { unlocked: false }
  | {
      unlocked: true;
      score: number;
      breakdown: { purpose: number; language: number; interest: number; preference: number };
      reasons: string[];
    };

export async function fetchCompatibility(targetUserId: string): Promise<Compatibility> {
  const { data, error } = await getSupabase().rpc('compatibility', { p_target: targetUserId });
  if (error) throw error;
  return data as unknown as Compatibility;
}

export type EventRow = Fn['list_events']['Returns'][number];
export type EventScope = 'upcoming' | 'mine' | 'past';

export async function fetchEvents(scope: EventScope = 'upcoming'): Promise<EventRow[]> {
  const { data, error } = await getSupabase().rpc('list_events', { p_scope: scope });
  if (error) throw error;
  return data ?? [];
}

export async function registerEvent(eventId: string): Promise<void> {
  const { error } = await getSupabase().rpc('register_event', { p_event: eventId });
  if (error) throw error;
}

export async function cancelEventRegistration(eventId: string): Promise<void> {
  const { error } = await getSupabase().rpc('cancel_event_registration', { p_event: eventId });
  if (error) throw error;
}

export type EventErrorCode = 'event_full' | 'event_early_access' | 'event_canceled' | 'event_started' | 'event_not_found' | 'inactive_member';

export function eventErrorCode(e: unknown): EventErrorCode | null {
  const msg = e instanceof Error ? e.message : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  for (const c of ['event_full', 'event_early_access', 'event_canceled', 'event_started', 'event_not_found', 'inactive_member'] as const) {
    if (msg.includes(c)) return c;
  }
  return null;
}

export function isPremiumRequired(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  return msg.includes('premium_required') || msg.includes('plan_feature_required');
}

// admin
export interface AdminEventInput {
  id?: string;
  title_ja: string;
  title_ko: string;
  description_ja: string;
  description_ko: string;
  location_ja: string | null;
  location_ko: string | null;
  is_online: boolean;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  price_jpy: number;
  early_access_hours: number | null;
  published?: boolean;
  canceled?: boolean;
}

export async function adminUpsertEvent(input: AdminEventInput): Promise<string> {
  const { data, error } = await getSupabase().rpc('admin_upsert_event', { p_event: input as unknown as Json });
  if (error) throw error;
  return data;
}

export type AdminEvent = Database['public']['Tables']['events']['Row'];

export async function adminFetchEvents(): Promise<AdminEvent[]> {
  const { data, error } = await getSupabase().from('events').select('*').order('starts_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type AdminEventRegistration = Fn['admin_event_registrations']['Returns'][number];

export async function adminFetchEventRegistrations(eventId: string): Promise<AdminEventRegistration[]> {
  const { data, error } = await getSupabase().rpc('admin_event_registrations', { p_event: eventId });
  if (error) throw error;
  return data ?? [];
}
