import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Languages, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getSupabase } from '@/lib/supabase';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { fetchMessages, markConversationRead, sendMessage, subscribeToConversation } from '../api/messages';
import { fetchPublicProfile } from '../api/profile';
import { defaultUserSettings, fetchMySettings, fetchPublicSettings, upsertMySettings, type PublicSettings, type UserSettings } from '../api/settings';
import {
  fetchCachedTranslations,
  guessLang,
  TranslateError,
  translateDraft,
  translateMessage,
} from '../api/translation';
import { Avatar } from '../components/ProfileCard';
import type { Conversation, Message, PublicProfile } from '../types';
import { formatTime, useI18n } from '../i18n';
import type { MessageKey } from '../i18n/ja';
import { errorMessage } from '../labels';
import { PlanLimitNotice, usePlanLimitText } from '../components/PlanLimitNotice';

type TranslationState =
  | { status: 'loading' }
  | { status: 'done'; text: string; sameLang: boolean; showOriginal: boolean }
  | { status: 'error'; message: string };

type DraftState =
  | { status: 'idle' }
  | { status: 'loading'; target: string }
  | { status: 'ready'; target: string; original: string; text: string }
  | { status: 'error'; target: string; message: string };

const TARGETS = ['ja', 'ko'] as const;

const ChatPage: React.FC = () => {
  const { conversationId = '' } = useParams();
  const { user, profile: me } = useSupabaseAuth();
  const { t, lang, locale } = useI18n();
  const [conv, setConv] = useState<(Conversation & { is_active: boolean }) | null>(null);
  const [peer, setPeer] = useState<PublicProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [limitNotice, setLimitNotice] = useState<{ upgrade: boolean; text: string } | null>(null);
  const limitText = usePlanLimitText();
  const [pub, setPub] = useState<PublicSettings | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({});
  const [draft, setDraft] = useState<DraftState>({ status: 'idle' });
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoRequested = useRef<Set<string>>(new Set());

  const translationEnabled = pub?.translation_enabled ?? false;
  const targetLang = settings?.translate_target_lang ?? lang;
  const autoTranslate = translationEnabled && (pub?.translation_auto_enabled ?? false) && (settings?.auto_translate ?? false);

  const translateErrorText = useCallback(
    (e: unknown): string => {
      if (e instanceof TranslateError) {
        const map: Partial<Record<TranslateError['code'], MessageKey>> = {
          too_long: 'chat.errTooLong',
          rate_limited: 'chat.errRateLimited',
          daily_limit: 'chat.errDailyLimit',
          translation_disabled: 'chat.errDisabled',
          inactive_member: 'chat.errInactive',
          provider_failed: 'chat.errProvider',
          network: 'chat.errProvider',
        };
        const key = map[e.code];
        if (key) {
          const n = typeof e.detail.max_chars === 'number' ? e.detail.max_chars : typeof e.detail.per_day === 'number' ? e.detail.per_day : '';
          if (e.code === 'daily_limit') setLimitNotice({ upgrade: true, text: t(key, { n }) });
          return t(key, { n });
        }
        return t('chat.translateFailed');
      }
      return errorMessage(e, lang);
    },
    [t, lang],
  );

  const requestTranslation = useCallback(
    async (m: Message) => {
      setTranslations((prev) => ({ ...prev, [m.id]: { status: 'loading' } }));
      try {
        const r = await translateMessage(m.id, targetLang);
        setTranslations((prev) => ({
          ...prev,
          [m.id]: { status: 'done', text: r.translated, sameLang: r.same_lang, showOriginal: r.same_lang },
        }));
      } catch (e) {
        setTranslations((prev) => ({ ...prev, [m.id]: { status: 'error', message: translateErrorText(e) } }));
      }
    },
    [targetLang, translateErrorText],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchPublicSettings().then((p) => !cancelled && setPub(p)).catch(() => undefined);
    fetchMySettings(user.id).then((s) => !cancelled && setSettings(s)).catch(() => undefined);
    (async () => {
      const { data, error: err } = await getSupabase()
        .from('conversations')
        .select('*, matches!inner(user_low_id, user_high_id, is_active)')
        .eq('id', conversationId)
        .maybeSingle();
      if (cancelled) return;
      if (err || !data) {
        setError(t('chat.cannotOpen'));
        return;
      }
      const { matches: match, ...conversation } = data;
      if (match.user_low_id !== user.id && match.user_high_id !== user.id) {
        setError(t('chat.cannotOpen'));
        return;
      }
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

  // 既存キャッシュ (message_translations) を先に反映。翻訳先が変わったら取り直す
  useEffect(() => {
    if (!user || !translationEnabled || messages.length === 0) return;
    const ids = messages.filter((m) => m.sender_id !== user.id && !translations[m.id]).map((m) => m.id);
    if (ids.length === 0) return;
    let cancelled = false;
    fetchCachedTranslations(ids, targetLang)
      .then((cache) => {
        if (cancelled || cache.size === 0) return;
        setTranslations((prev) => {
          const next = { ...prev };
          cache.forEach((text, id) => {
            if (!next[id]) next[id] = { status: 'done', text, sameLang: false, showOriginal: false };
          });
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, targetLang, translationEnabled, user]);

  useEffect(() => {
    setTranslations({});
    autoRequested.current.clear();
  }, [targetLang]);

  // 自動翻訳: 受信メッセージのうち翻訳先と異なる言語のものだけ (同一言語はサーバーを呼ばない)
  useEffect(() => {
    if (!user || !autoTranslate) return;
    for (const m of messages) {
      if (m.sender_id === user.id || translations[m.id] || autoRequested.current.has(m.id)) continue;
      if (guessLang(m.body) === targetLang) continue;
      autoRequested.current.add(m.id);
      void requestTranslation(m);
    }
  }, [messages, autoTranslate, targetLang, translations, user, requestTranslation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, draft.status]);

  const doSend = async (body: string, aiAssisted: boolean) => {
    if (!body || !user || sending) return;
    setSending(true);
    setError('');
    try {
      const guessed = guessLang(body);
      const m = await sendMessage(conversationId, user.id, body, guessed === 'und' ? me?.preferred_ui_lang ?? undefined : guessed, aiAssisted);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setText('');
      setDraft({ status: 'idle' });
    } catch (e) {
      const lim = limitText(e);
      if (lim) setLimitNotice({ upgrade: lim.kind !== 'message_rate', text: lim.text });
      else setError(errorMessage(e, lang));
    } finally {
      setSending(false);
    }
  };

  const submit = () => doSend(text.trim(), false);

  const requestDraft = async (target: string) => {
    const original = text.trim();
    if (!original) return;
    setDraft({ status: 'loading', target });
    try {
      const r = await translateDraft(original, target, me?.preferred_ui_lang ?? undefined);
      if (r.same_lang) {
        setDraft({ status: 'error', target, message: t('chat.draftSameLang') });
        return;
      }
      setDraft({ status: 'ready', target, original, text: r.translated });
    } catch (e) {
      setDraft({ status: 'error', target, message: translateErrorText(e) });
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const draftTargets = useMemo(() => {
    const g = guessLang(text);
    return TARGETS.filter((l) => l !== g);
  }, [text]);

  const canChat = !!conv && conv.is_active;

  // ヘッダーの「AI翻訳」: 未翻訳の受信メッセージをまとめて翻訳し、翻訳済みは訳文表示に戻す
  const pendingTargets = useMemo(
    () => (user ? messages.filter((m) => m.sender_id !== user.id && !translations[m.id] && guessLang(m.body) !== targetLang) : []),
    [messages, translations, targetLang, user],
  );
  const translatedCount = useMemo(
    () => Object.values(translations).filter((s) => s.status === 'done' && !s.sameLang).length,
    [translations],
  );
  const anyOriginalShown = useMemo(
    () => Object.values(translations).some((s) => s.status === 'done' && !s.sameLang && s.showOriginal),
    [translations],
  );
  const translateAll = () => {
    if (pendingTargets.length > 0) {
      for (const m of pendingTargets) {
        autoRequested.current.add(m.id);
        void requestTranslation(m);
      }
    }
    if (anyOriginalShown) {
      setTranslations((prev) => {
        const next = { ...prev };
        for (const [id, s] of Object.entries(next)) {
          if (s.status === 'done' && !s.sameLang) next[id] = { ...s, showOriginal: false };
        }
        return next;
      });
    }
  };
  const showAllOriginal = () =>
    setTranslations((prev) => {
      const next = { ...prev };
      for (const [id, s] of Object.entries(next)) {
        if (s.status === 'done' && !s.sameLang) next[id] = { ...s, showOriginal: true };
      }
      return next;
    });
  const changeTarget = (l: string) => {
    if (l === targetLang || !user) return;
    setSettings((prev) => ({ ...(prev ?? defaultUserSettings(user.id)), translate_target_lang: l }));
    upsertMySettings(user.id, { translate_target_lang: l }).catch(() => undefined);
  };

  const toggleOriginal = (id: string) =>
    setTranslations((prev) => {
      const s = prev[id];
      return s?.status === 'done' ? { ...prev, [id]: { ...s, showOriginal: !s.showOriginal } } : prev;
    });

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem-6rem)] md:h-[calc(100dvh-3rem-4rem)] -mx-4 -my-4">
      <div className="flex items-center gap-3 px-3 py-2 bg-white border-b border-gray-200">
        <Link to="/app/matches" className="text-gray-600" aria-label={t('common.back')}><ArrowLeft className="w-5 h-5" /></Link>
        {peer && (
          <Link to={`/app/users/${peer.id}`} className="flex items-center gap-2 min-w-0">
            <Avatar path={peer.primary_photo_path} name={peer.nickname} className="w-9 h-9 rounded-full" />
            <span className="font-semibold truncate">{peer.nickname}</span>
          </Link>
        )}
        <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
          {conv && !conv.is_active && t('chat.ended')}
        </span>
      </div>

      {translationEnabled && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border-b border-rose-100">
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-3 gap-1"
            onClick={translateAll}
            disabled={pendingTargets.length === 0 && !anyOriginalShown}
            aria-label={t('chat.translateAll')}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('chat.translate')}
            {pendingTargets.length > 0 && <span className="text-[10px] opacity-90">({pendingTargets.length})</span>}
          </Button>
          {translatedCount > 0 && !anyOriginalShown && (
            <button type="button" onClick={showAllOriginal} className="text-xs text-rose-700 underline-offset-2 hover:underline min-h-8">
              {t('chat.showOriginal')}
            </button>
          )}
          <div className="ml-auto flex items-center gap-1" role="group" aria-label={t('settings.translateTarget')}>
            <Languages className="w-3.5 h-3.5 text-rose-600" />
            <div className="flex rounded-full border border-rose-300 bg-white overflow-hidden text-xs">
              {TARGETS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => changeTarget(l)}
                  aria-pressed={targetLang === l}
                  className={cn('px-3 min-h-8 font-medium', targetLang === l ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-100')}
                >
                  {l === 'ja' ? '日本語' : '한국어'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {autoTranslate && (
        <p className="px-3 py-1 text-[11px] text-gray-500 bg-white border-b border-gray-100 flex items-center gap-1">
          <Languages className="w-3 h-3" />{t('chat.autoTranslateOn')}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        {messages.length === 0 && !error && (
          <p className="text-center text-sm text-gray-500 py-8">{t('chat.firstMessage')}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const tr = translations[m.id];
          const canTranslate = translationEnabled && !mine && guessLang(m.body) !== targetLang;
          const showTranslated = tr?.status === 'done' && !tr.showOriginal;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm break-words', mine ? 'bg-rose-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 rounded-bl-sm')}>
                {showTranslated ? (
                  <>
                    <div className="flex items-center gap-1 text-[10px] text-rose-600 mb-0.5">
                      <Sparkles className="w-3 h-3" />{t('chat.translated')}
                    </div>
                    <p className="whitespace-pre-wrap">{tr.text}</p>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap">{m.body}</p>
                )}
                {!mine && tr?.status === 'done' && !tr.sameLang && (
                  <button type="button" onClick={() => toggleOriginal(m.id)} className="mt-1 text-xs text-rose-600 underline-offset-2 hover:underline min-h-6">
                    {tr.showOriginal ? t('chat.showTranslation') : t('chat.showOriginal')}
                  </button>
                )}
                {canTranslate && !tr && (
                  <button type="button" onClick={() => void requestTranslation(m)} className="mt-1 flex items-center gap-1 text-xs text-rose-600 hover:underline min-h-6">
                    <Sparkles className="w-3 h-3" />{t('chat.translate')}
                  </button>
                )}
                {tr?.status === 'loading' && <p className="mt-1 text-xs text-gray-400">{t('chat.translating')}</p>}
                {tr?.status === 'error' && (
                  <div className="mt-1 text-xs text-gray-500">
                    <span>{tr.message}</span>{' '}
                    <button type="button" onClick={() => void requestTranslation(m)} className="text-rose-600 hover:underline min-h-6">{t('chat.retry')}</button>
                  </div>
                )}
                <div className={cn('text-[10px] mt-0.5 text-right flex items-center justify-end gap-1', mine ? 'text-rose-100' : 'text-gray-400')}>
                  {m.ai_assisted && (
                    <span className="inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />{t('chat.aiAssisted')}</span>
                  )}
                  <span>{formatTime(m.created_at, locale)}{mine && m.read_at ? ` ${t('chat.read')}` : ''}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {draft.status !== 'idle' && (
        <div className="bg-rose-50 border-t border-rose-200 p-3 space-y-2" role="region" aria-label={t('chat.draftTitle')}>
          <div className="flex items-center gap-1 text-sm font-semibold text-rose-700">
            <Sparkles className="w-4 h-4" />{t('chat.draftTitle')}
          </div>
          {draft.status === 'loading' && <p className="text-sm text-gray-600">{t('chat.translating')}</p>}
          {draft.status === 'error' && (
            <div className="flex items-center justify-between gap-2 text-sm text-gray-700">
              <span>{draft.message}</span>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => void requestDraft(draft.target)}>{t('chat.retry')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft({ status: 'idle' })}>{t('chat.draftCancel')}</Button>
              </div>
            </div>
          )}
          {draft.status === 'ready' && (
            <>
              <p className="text-xs text-gray-600">{t('chat.draftLead')}</p>
              <p className="text-xs text-gray-500"><span className="font-medium">{t('chat.draftOriginal')}:</span> {draft.original}</p>
              <Textarea
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                rows={3}
                maxLength={2000}
                aria-label={t('chat.draftTitle')}
                className="bg-white resize-none"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setDraft({ status: 'idle' })}>{t('chat.draftCancel')}</Button>
                <Button className="flex-1 h-11 bg-rose-600 hover:bg-rose-700" disabled={sending || !draft.text.trim()} onClick={() => void doSend(draft.text.trim(), true)}>
                  <Send className="w-4 h-4 mr-1" />{t('chat.draftSend')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="bg-white border-t border-gray-200">
        {limitNotice && <PlanLimitNotice text={limitNotice.text} showUpgrade={limitNotice.upgrade} className="m-2" />}
        {translationEnabled && canChat && text.trim() && draft.status === 'idle' && (
          <div className="flex items-center gap-2 px-2 pt-2 text-xs text-gray-500">
            <Languages className="w-3.5 h-3.5 shrink-0" />
            <span className="shrink-0">{t('chat.draftTranslateTo')}:</span>
            {draftTargets.map((l) => (
              <button key={l} type="button" onClick={() => void requestDraft(l)} className="min-h-8 px-2 rounded-full border border-rose-300 text-rose-700 bg-rose-50">
                {t(l === 'ja' ? 'chat.draftTranslateJa' : 'chat.draftTranslateKo')}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 p-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            maxLength={2000}
            placeholder={conv && !conv.is_active ? t('chat.endedPlaceholder') : t('chat.placeholder')}
            disabled={!canChat}
            className="min-h-[40px] max-h-32 resize-none"
          />
          <Button size="icon" className="bg-rose-600 hover:bg-rose-700 shrink-0" onClick={submit} disabled={sending || !text.trim() || !canChat} aria-label={t('chat.placeholder')}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
