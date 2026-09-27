import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { fetchMyConversations, type ConversationSummary } from '../api/settings';
import { subscribeToNotifications } from '../api/messages';
import { Avatar } from '../components/ProfileCard';
import { formatTime, useI18n } from '../i18n';
import { useErrorMessage } from '../hooks';

const ChatsPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const { t, locale } = useI18n();
  const errMsg = useErrorMessage();
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchMyConversations()
      .then(setItems)
      .catch((e) => setError(errMsg(e)));
  }, [errMsg]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = subscribeToNotifications(user.id, () => load());
    return () => {
      void ch.unsubscribe();
    };
  }, [user, load]);

  if (error) return <p className="text-sm text-red-600 py-6 text-center">{error}</p>;
  if (!items) return <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>;

  const active = items.filter((c) => c.is_active);
  const ended = items.filter((c) => !c.is_active);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t('chats.title')}</h1>

      {items.length === 0 && (
        <div className="text-center py-16 text-gray-500 space-y-2">
          <MessageCircle className="w-10 h-10 mx-auto text-gray-300" aria-hidden />
          <p className="font-medium">{t('chats.empty')}</p>
          <p className="text-sm">{t('chats.emptyLead')}</p>
        </div>
      )}

      <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
        {active.map((c) => (
          <ConversationRow key={c.conversation_id} c={c} locale={locale} />
        ))}
      </ul>

      {ended.length > 0 && (
        <details className="text-sm text-gray-500">
          <summary className="cursor-pointer py-2">{t('chats.ended')} ({ended.length})</summary>
          <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 mt-2 opacity-70">
            {ended.map((c) => (
              <ConversationRow key={c.conversation_id} c={c} locale={locale} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

const ConversationRow: React.FC<{ c: ConversationSummary; locale: string }> = ({ c, locale }) => {
  const { t } = useI18n();
  const unread = c.unread_count ?? 0;
  return (
    <li>
      <Link
        to={`/app/chat/${c.conversation_id}`}
        className="flex items-center gap-3 px-3 py-3 min-h-[64px] hover:bg-gray-50 focus:outline-none focus-visible:bg-rose-50"
      >
        <Avatar path={c.peer_photo_path} name={c.peer_nickname} className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className={unread ? 'font-semibold truncate' : 'font-medium truncate'}>
              {c.peer_nickname ?? t('matches.hiddenUser')}
            </span>
            <time className="text-[11px] text-gray-400 shrink-0">{formatTime(c.last_message_at, locale)}</time>
          </div>
          <p className={`text-sm truncate ${unread ? 'text-gray-900' : 'text-gray-500'}`}>
            {c.last_message_preview ?? t('chats.noMessage')}
          </p>
        </div>
        {unread > 0 && (
          <span
            aria-label={t('chats.unreadAria', { n: unread })}
            className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center shrink-0"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>
    </li>
  );
};

export default ChatsPage;
