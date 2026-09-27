import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Message, Notification } from '../types';

export async function fetchMessages(conversationId: string, limit = 100): Promise<Message[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  bodyLang?: string,
): Promise<Message> {
  const { data, error } = await getSupabase()
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body, body_lang: bodyLang ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function markConversationRead(conversationId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return data ?? 0;
}

export function subscribeToConversation(
  conversationId: string,
  onMessage: (m: Message) => void,
  onUpdate?: (m: Message) => void,
): RealtimeChannel {
  return getSupabase()
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(payload.new as Message),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onUpdate?.(payload.new as Message),
    )
    .subscribe();
}

export async function fetchUnreadCounts(userId: string): Promise<Map<string, number>> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('conversation_id')
    .neq('sender_id', userId)
    .is('read_at', null)
    .is('deleted_at', null);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
  return counts;
}

export async function fetchNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getSupabase().from('notifications').update({ is_read: true }).in('id', ids);
  if (error) throw error;
}

export function subscribeToNotifications(
  userId: string,
  onNotification: (n: Notification) => void,
): RealtimeChannel {
  return getSupabase()
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onNotification(payload.new as Notification),
    )
    .subscribe();
}
