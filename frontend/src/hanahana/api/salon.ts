import { getSupabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type { ReportReason } from '../types';

type Fn = Database['public']['Functions'];
type Tables = Database['public']['Tables'];

export type SalonCategory = Tables['salon_categories']['Row'];
export type SalonPost = Tables['salon_posts']['Row'];
export type SalonFeedItem = Fn['salon_feed']['Returns'][number];
export type SalonComment = Fn['salon_post_comments']['Returns'][number];
export type SalonFeedKind = 'new' | 'hot' | 'replied' | 'joined' | 'mine';
export type SalonModerationAction = 'hide' | 'unhide' | 'delete' | 'pin' | 'unpin' | 'clear_flag';
export type AdminSalonPost = Fn['admin_salon_posts']['Returns'][number];
export type AdminSalonComment = Fn['admin_salon_comments']['Returns'][number];

export const SALON_PHOTO_BUCKET = 'salon-photos';
export const SALON_FEED_KINDS: SalonFeedKind[] = ['new', 'hot', 'replied', 'joined'];

export async function fetchSalonCategories(): Promise<SalonCategory[]> {
  const { data, error } = await getSupabase()
    .from('salon_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export interface FeedQuery {
  kind: SalonFeedKind;
  category?: string | null;
  query?: string;
  limit?: number;
  offset?: number;
}

export async function fetchSalonFeed(q: FeedQuery): Promise<SalonFeedItem[]> {
  const { data, error } = await getSupabase().rpc('salon_feed', {
    p_kind: q.kind,
    p_category: q.category ?? undefined,
    p_query: q.query?.trim() || undefined,
    p_limit: q.limit ?? 20,
    p_offset: q.offset ?? 0,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSalonPost(postId: string): Promise<SalonFeedItem | null> {
  const { data, error } = await getSupabase().rpc('salon_post_detail', { p_post: postId });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchSalonComments(postId: string): Promise<SalonComment[]> {
  const { data, error } = await getSupabase().rpc('salon_post_comments', { p_post: postId });
  if (error) throw error;
  return data ?? [];
}

export interface NewPostInput {
  category_id: string;
  title: string;
  body: string;
  body_lang: string;
  photo_path: string | null;
}

export async function createSalonPost(userId: string, input: NewPostInput): Promise<string> {
  const { data, error } = await getSupabase()
    .from('salon_posts')
    .insert({ author_id: userId, ...input })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateSalonPost(
  postId: string,
  patch: Partial<Pick<NewPostInput, 'category_id' | 'title' | 'body' | 'body_lang' | 'photo_path'>>,
): Promise<void> {
  const { error } = await getSupabase().from('salon_posts').update(patch).eq('id', postId);
  if (error) throw error;
}

export async function deleteSalonPost(postId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('salon_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw error;
}

export async function createSalonComment(userId: string, postId: string, body: string, bodyLang: string): Promise<void> {
  const { error } = await getSupabase()
    .from('salon_comments')
    .insert({ post_id: postId, author_id: userId, body, body_lang: bodyLang });
  if (error) throw error;
}

export async function deleteSalonComment(commentId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('salon_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
}

export async function toggleReaction(userId: string, postId: string, reacted: boolean): Promise<void> {
  const sb = getSupabase();
  const { error } = reacted
    ? await sb.from('salon_reactions').delete().eq('post_id', postId).eq('user_id', userId)
    : await sb.from('salon_reactions').insert({ post_id: postId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}

export async function uploadSalonPhoto(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabase().storage.from(SALON_PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

const signedUrlCache = new Map<string, { url: string; expires: number }>();

export async function salonPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const hit = signedUrlCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await getSupabase().storage.from(SALON_PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  signedUrlCache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export interface SalonReportTarget {
  postId?: string;
  commentId?: string;
}

export async function reportSalonContent(
  reporterId: string,
  authorId: string,
  reason: ReportReason,
  detail: string | undefined,
  target: SalonReportTarget,
): Promise<void> {
  const { error } = await getSupabase().from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: authorId,
    reason,
    detail: detail ?? null,
    salon_post_id: target.postId ?? null,
    salon_comment_id: target.commentId ?? null,
  });
  if (error) throw error;
}

export async function fetchSalonUnread(): Promise<number> {
  const { data, error } = await getSupabase().rpc('my_salon_unread');
  if (error) throw error;
  return data ?? 0;
}

export async function markSalonNotificationsRead(): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ is_read: true })
    .in('type', ['salon_comment', 'salon_reaction', 'salon_moderation'])
    .eq('is_read', false);
  if (error) throw error;
}

/** 既存キャッシュ (RLS: 閲覧可能な投稿のみ) */
export async function fetchSalonTranslations(
  targets: { type: 'post_title' | 'post_body' | 'comment'; id: string }[],
  targetLang: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (targets.length === 0) return out;
  const { data, error } = await getSupabase()
    .from('salon_translations')
    .select('target_type, target_id, translated_body')
    .eq('target_lang', targetLang)
    .in('target_id', targets.map((t) => t.id));
  if (error) throw error;
  for (const r of data ?? []) out.set(`${r.target_type}:${r.target_id}`, r.translated_body);
  return out;
}

// ---- 運営 ----

export async function adminFetchSalonPosts(filter: string, category?: string | null): Promise<AdminSalonPost[]> {
  const { data, error } = await getSupabase().rpc('admin_salon_posts', {
    p_filter: filter,
    p_category: category ?? undefined,
    p_size: 100,
    p_offset: 0,
  });
  if (error) throw error;
  return data ?? [];
}

export async function adminFetchSalonComments(filter: string, postId?: string): Promise<AdminSalonComment[]> {
  const { data, error } = await getSupabase().rpc('admin_salon_comments', {
    p_filter: filter,
    p_post: postId,
    p_size: 100,
    p_offset: 0,
  });
  if (error) throw error;
  return data ?? [];
}

export async function adminModerateSalon(
  targetType: 'post' | 'comment',
  targetId: string,
  action: SalonModerationAction,
  reason?: string,
): Promise<void> {
  const { error } = await getSupabase().rpc('admin_salon_moderate', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_action: action,
    p_reason: reason,
  });
  if (error) throw error;
}

export type SalonStats = Record<string, number>;

export async function adminFetchSalonStats(): Promise<SalonStats> {
  const { data, error } = await getSupabase().rpc('admin_salon_stats');
  if (error) throw error;
  const out: SalonStats = {};
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [k, v] of Object.entries(data)) if (typeof v === 'number') out[k] = v;
  }
  return out;
}

export type SalonModerationLog = Tables['salon_moderation_actions']['Row'];

export async function adminFetchSalonModerationLog(): Promise<SalonModerationLog[]> {
  const { data, error } = await getSupabase()
    .from('salon_moderation_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
