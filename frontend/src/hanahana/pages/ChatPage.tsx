import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getSupabase } from '@/lib/supabase';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { fetchMessages, markConversationRead, sendMessage, subscribeToConversation } from '../api/messages';
import { fetchPublicProfile } from '../api/profile';
import { Avatar } from '../components/ProfileCard';
import type { Conversation, Message, PublicProfile } from '../types';

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatPage: React.FC = () => {
  const { conversationId = '' } = useParams();
  const { user, profile: me } = useSupabaseAuth();
  const [conv, setConv] = useState<(Conversation & { is_active: boolean }) | null>(null);
  const [peer, setPeer] = useState<PublicProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await getSupabase()
        .from('conversations')
        .select('*, matches!inner(user_low_id, user_high_id, is_active)')
        .eq('id', conversationId)
        .maybeSingle();
      if (cancelled) return;
      if (err || !data) {
        setError('この会話を表示できません');
        return;
      }
      const { matches: match, ...conversation } = data;
      setConv({ ...conversation, is_active: match.is_active });
      const peerId = match.user_low_id === user.id ? match.user_high_id : match.user_low_id;
      fetchPublicProfile(peerId).then((p) => !cancelled && setPeer(p)).catch(() => undefined);
      const ms = await fetchMessages(conversationId);
      if (cancelled) return;
      setMessages(ms);
      void markConversationRead(conversationId);
    })();

    const ch = subscribeToConversation(
      conversationId,
      (m) => {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id !== user.id) void markConversationRead(conversationId);
      },
      (m) => setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    );
    return () => {
      cancelled = true;
      void ch.unsubscribe();
    };
  }, [conversationId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const submit = async () => {
    const body = text.trim();
    if (!body || !user || sending) return;
    setSending(true);
    setError('');
    try {
      const m = await sendMessage(conversationId, user.id, body, me?.preferred_ui_lang ?? undefined);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem-6rem)] md:h-[calc(100dvh-3rem-4rem)] -mx-4 -my-4">
      <div className="flex items-center gap-3 px-3 py-2 bg-white border-b border-gray-200">
        <Link to="/app/matches" className="text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        {peer && (
          <Link to={`/app/users/${peer.id}`} className="flex items-center gap-2 min-w-0">
            <Avatar path={peer.primary_photo_path} name={peer.nickname} className="w-9 h-9 rounded-full" />
            <span className="font-semibold truncate">{peer.nickname}</span>
          </Link>
        )}
        {conv && !conv.is_active && <span className="ml-auto text-xs text-gray-500">終了した会話</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        {messages.length === 0 && !error && (
          <p className="text-center text-sm text-gray-500 py-8">マッチしました！最初のメッセージを送ってみましょう</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words', mine ? 'bg-rose-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 rounded-bl-sm')}>
                {m.body}
                <div className={cn('text-[10px] mt-0.5 text-right', mine ? 'text-rose-100' : 'text-gray-400')}>
                  {fmtTime(m.created_at)}{mine && m.read_at ? ' 既読' : ''}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 p-2 bg-white border-t border-gray-200">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          maxLength={2000}
          placeholder={conv && !conv.is_active ? 'この会話は終了しています' : 'メッセージを入力'}
          disabled={!conv || !conv.is_active}
          className="min-h-[40px] max-h-32 resize-none"
        />
        <Button size="icon" className="bg-rose-600 hover:bg-rose-700 shrink-0" onClick={submit} disabled={sending || !text.trim() || !conv?.is_active}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatPage;
