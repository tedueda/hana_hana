import { getSupabase } from '@/lib/supabase';
import type { Like, MatchWithPeer, PublicProfile, ReportReason } from '../types';
import { fetchPublicProfiles } from './profile';

export interface LikeResult {
  like: Like;
  /** 相互いいねで match が成立したか (DB トリガーが作成) */
  matched: boolean;
  conversationId: string | null;
}

/** いいね送信。既存行があれば active に戻す (トリガー側で match 判定) */
export async function sendLike(fromUserId: string, toUserId: string): Promise<LikeResult> {
  const sb = getSupabase();
  // authenticated には likes の update 権限が status 列にしか無いため upsert は使えない
  let { data, error } = await sb
    .from('likes')
    .insert({ from_user_id: fromUserId, to_user_id: toUserId, status: 'active' })
    .select('*')
    .single();
  if (error?.code === '23505') {
    ({ data, error } = await sb
      .from('likes')
      .update({ status: 'active' })
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .select('*')
      .single());
  }
  if (error) throw error;
  if (!data) throw new Error('like row not returned');

  const low = fromUserId < toUserId ? fromUserId : toUserId;
  const high = fromUserId < toUserId ? toUserId : fromUserId;
  const m = await sb
    .from('matches')
    .select('id, is_active, conversations(id)')
    .eq('user_low_id', low)
    .eq('user_high_id', high)
    .eq('is_active', true)
    .maybeSingle();
  if (m.error) throw m.error;
  const conv = m.data?.conversations as { id: string } | { id: string }[] | null | undefined;
  const conversationId = Array.isArray(conv) ? conv[0]?.id ?? null : conv?.id ?? null;
  return { like: data, matched: Boolean(m.data), conversationId };
}

export async function withdrawLike(fromUserId: string, toUserId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('likes')
    .update({ status: 'withdrawn' })
    .eq('from_user_id', fromUserId)
    .eq('to_user_id', toUserId);
  if (error) throw error;
}

export async function fetchSentLikes(userId: string): Promise<Like[]> {
  const { data, error } = await getSupabase()
    .from('likes')
    .select('*')
    .eq('from_user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchReceivedLikes(userId: string): Promise<Like[]> {
  const { data, error } = await getSupabase()
    .from('likes')
    .select('*')
    .eq('to_user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchLikesWithProfiles(
  userId: string,
): Promise<{ sent: { like: Like; peer: PublicProfile }[]; received: { like: Like; peer: PublicProfile }[] }> {
  const [sent, received] = await Promise.all([fetchSentLikes(userId), fetchReceivedLikes(userId)]);
  const ids = [...sent.map((l) => l.to_user_id), ...received.map((l) => l.from_user_id)];
  const profiles = await fetchPublicProfiles(Array.from(new Set(ids)));
  const join = (likes: Like[], key: 'to_user_id' | 'from_user_id') =>
    likes.flatMap((like) => {
      const peer = profiles.get(like[key]);
      return peer ? [{ like, peer }] : [];
    });
  return { sent: join(sent, 'to_user_id'), received: join(received, 'from_user_id') };
}

export async function fetchMatches(userId: string): Promise<MatchWithPeer[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('matches')
    .select('*, conversations(*)')
    .eq('is_active', true)
    .or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`)
    .order('matched_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const peerIds = rows.map((m) => (m.user_low_id === userId ? m.user_high_id : m.user_low_id));
  const profiles = await fetchPublicProfiles(peerIds);
  return rows.map((row) => {
    const { conversations, ...match } = row;
    const conv = Array.isArray(conversations) ? conversations[0] ?? null : conversations ?? null;
    const peerId = match.user_low_id === userId ? match.user_high_id : match.user_low_id;
    return { match, conversation: conv, peer: profiles.get(peerId) ?? null };
  });
}

export async function unmatch(matchId: string): Promise<void> {
  const { error } = await getSupabase().rpc('unmatch', { p_match_id: matchId });
  if (error) throw error;
}

export async function blockUser(blockerId: string, blockedId: string, reason?: string): Promise<void> {
  const { error } = await getSupabase()
    .from('blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId, reason: reason ?? null });
  if (error) throw error;
}

export async function reportUser(
  reporterId: string,
  reportedUserId: string,
  reason: ReportReason,
  detail?: string,
  messageId?: string,
): Promise<void> {
  const { error } = await getSupabase().from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    reason,
    detail: detail ?? null,
    message_id: messageId ?? null,
  });
  if (error) throw error;
}
