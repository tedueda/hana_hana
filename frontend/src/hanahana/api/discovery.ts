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
