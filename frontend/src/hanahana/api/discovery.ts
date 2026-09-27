import { getSupabase } from '@/lib/supabase';
import type { Json } from '@/types/supabase';
import type { PublicProfile, RecommendedUser, SearchFilters } from '../types';
import { fetchPublicProfiles } from './profile';

export async function fetchRecommendations(limit = 20): Promise<RecommendedUser[]> {
  const { data, error } = await getSupabase().rpc('recommend_users', { p_limit: limit });
  if (error) throw error;
  const rows = data ?? [];
  const profiles = await fetchPublicProfiles(rows.map((r) => r.id));
  return rows.flatMap((r) => {
    const profile = profiles.get(r.id);
    return profile ? [{ id: r.id, score: r.score, reasons: r.reasons ?? [], profile }] : [];
  });
}

export async function passUser(targetUserId: string): Promise<void> {
  const { error } = await getSupabase().rpc('pass_user', { p_target: targetUserId });
  if (error) throw error;
}

export async function undoPass(targetUserId: string): Promise<void> {
  const { error } = await getSupabase().rpc('undo_pass', { p_target: targetUserId });
  if (error) throw error;
}

const FILTER_KEYS: (keyof SearchFilters)[] = [
  'nationality', 'residence_country', 'residence_region_id', 'gender', 'age_min', 'age_max',
  'purposes', 'interests', 'native_language', 'learning_language', 'learning_level', 'meeting_pref', 'verified_only',
];

export function isEmptyFilters(f: SearchFilters): boolean {
  return FILTER_KEYS.every((k) => {
    const v = f[k];
    return v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
  });
}

export async function loadSavedSearch(userId: string): Promise<SearchFilters | null> {
  const { data, error } = await getSupabase().from('user_settings').select('saved_search').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const j = data?.saved_search;
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const src = j as Record<string, Json>;
  const out: Record<string, Json> = {};
  for (const k of FILTER_KEYS) if (src[k] !== undefined) out[k] = src[k];
  return out as SearchFilters;
}

export async function saveSearch(userId: string, filters: SearchFilters | null): Promise<void> {
  const { error } = await getSupabase()
    .from('user_settings')
    .upsert({ user_id: userId, saved_search: filters as Json | null }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function searchProfiles(
  filters: SearchFilters,
  page = 1,
  size = 20,
): Promise<PublicProfile[]> {
  const cleaned: Record<string, Json> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    cleaned[k] = v as Json;
  }
  const { data, error } = await getSupabase().rpc('search_profiles', { filters: cleaned, page, size });
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.id);
  const profiles = await fetchPublicProfiles(ids);
  return ids.flatMap((id) => {
    const p = profiles.get(id);
    return p ? [p] : [];
  });
}

export async function recordView(targetUserId: string, userId: string): Promise<void> {
  await getSupabase()
    .from('user_events')
    .insert({ user_id: userId, target_user_id: targetUserId, event_type: 'view' });
}
