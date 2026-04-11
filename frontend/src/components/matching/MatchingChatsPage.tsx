import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';
import { Lock } from 'lucide-react';

type ChatItem = {
  chat_id: number;
  with_user_id: number;
  with_display_name: string;
  last_message?: string;
};

type ChatRequest = {
  request_id: number;
  from_user_id: number;
  from_display_name: string;
  from_avatar_url?: string;
  identity?: string;
  prefecture?: string;
  age_band?: string;
  initial_message?: string;
  created_at?: string;
};

const MatchingChatsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  // ログイン状態と有料会員かどうか
  const isLoggedIn = !!user;
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchChats = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/matching/chats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/matching/chat_requests/incoming`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRequests(data.items || []);
    } catch (e: any) {
      console.error('Failed to fetch requests:', e);
    }
  };

  const handleAccept = async (requestId: number) => {
    if (!token) return;
    setActionLoading(requestId);
    try {
      const res = await fetch(`${API_URL}/api/matching/chat_requests/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      alert(t('matching.chatRequestAccepted'));
      await fetchRequests();
      await fetchChats();
      if (data.chat_id) {
        window.location.href = `/matching/chats/${data.chat_id}`;
      }
    } catch (e: any) {
      alert(t('matching.acceptFailed') + ': ' + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (requestId: number) => {
    if (!token) return;
    setActionLoading(requestId);
    try {
      const res = await fetch(`${API_URL}/api/matching/chat_requests/${requestId}/decline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      alert(t('matching.chatRequestDeclined'));
      await fetchRequests();
    } catch (e: any) {
      alert(t('matching.declineFailed') + ': ' + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (isPaidUser) {
      fetchChats();
      fetchRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isPaidUser]);

  // 未ログインの場合は会員登録を促す
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">{t('matching.registerPrompt')}</h2>
          <p className="text-gray-600 mb-6">
            {t('matching.matchingMemberOnly')}<br />
            {t('matching.findGreatEncounters')}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/register')}
              className="w-full px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
            >
              {t('matching.newMemberRegistration')}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              {t('auth.login')}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {t('matching.paidMemberChatAccess')}
          </p>
        </div>
      </div>
    );
  }

  // 有料会員でない場合はアップグレード画面を表示
  if (!isPaidUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <Lock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">{t('matching.paidMemberOnly')}</h2>
          <p className="text-gray-600 mb-6">
            {t('matching.chatOnlyForPaidMembers')}<br />
            {t('matching.chatWithMatches')}
          </p>
          <button
            onClick={() => navigate('/account')}
            className="w-full px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
          >
            {t('matching.becomePaidMember')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('matching.receivedMailRequests')}</h2>
          <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
            <ul className="space-y-3">
              {requests.map((req) => (
                <li key={req.request_id} className="border rounded p-3 bg-white">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {req.from_avatar_url ? (
                        <img 
                          src={req.from_avatar_url.startsWith('http') ? req.from_avatar_url : `${API_URL}${req.from_avatar_url}`}
                          alt={req.from_display_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-500">👤</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{req.from_display_name}</div>
                      <div className="text-xs text-gray-600">
                        {[req.age_band, req.prefecture].filter(Boolean).join(' ・ ')}
                      </div>
                      {req.initial_message && (
                        <div className="mt-1 text-sm text-gray-700">{req.initial_message}</div>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleAccept(req.request_id)}
                          disabled={actionLoading === req.request_id}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {t('matching.accept')}
                        </button>
                        <button
                          onClick={() => handleDecline(req.request_id)}
                          disabled={actionLoading === req.request_id}
                          className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                        >
                          {t('matching.decline')}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">{t('matching.chatList')}</h2>
        <div className="p-4 border rounded-lg bg-white">
          <div className="mb-3 flex gap-2">
            <button onClick={() => { fetchChats(); fetchRequests(); }} className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">{t('matching.refresh')}</button>
          </div>
          {loading && <div>{t('matching.loading')}</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.chat_id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.with_display_name}</div>
                  <div className="text-xs text-gray-600">{c.last_message || t('matching.noMessagesYet')}</div>
                </div>
                <a href={`/matching/chats/${c.chat_id}`} className="px-3 py-1 text-sm bg-pink-600 text-white rounded hover:bg-pink-700">{t('matching.open')}</a>
              </li>
            ))}
            {!loading && !error && items.length === 0 && (
              <li className="text-sm text-gray-500">{t('matching.noChatsYet')}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MatchingChatsPage;
