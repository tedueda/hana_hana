import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config';
import { Lock } from 'lucide-react';

type ChatItem = {
  chat_id: number;
  with_user_id: number;
  with_display_name: string;
  with_avatar_url?: string | null;
  last_message?: string;
  unread_count?: number;
  last_message_at?: string;
};

type ChatRequest = {
  request_id: number;
  from_user_id: number;
  to_user_id?: number;
  from_display_name: string;
  to_display_name?: string;
  from_avatar_url?: string;
  to_avatar_url?: string;
  identity?: string;
  prefecture?: string;
  age_band?: string;
  initial_message?: string;
  created_at?: string;
};

const MatchingChatShell: React.FC = () => {
  const { id, requestId } = useParams<{ id?: string; requestId?: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  // ログイン状態と有料会員かどうか
  const isLoggedIn = !!user;
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<ChatRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ChatRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const chatsUrl = `${API_URL}/api/matching/chats`;
      console.log('[DEBUG] Fetching chats from:', chatsUrl);
      const res = await fetch(chatsUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      console.log('[DEBUG] Chats response status:', res.status);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      console.log('[DEBUG] Chats data:', data);
      setChats(data.items || []);
    } catch (e: any) {
      console.error('[DEBUG] Chats fetch error:', e);
      setError(e?.message || '取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomingRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/matching/chat_requests/incoming`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setIncomingRequests(data.items || []);
    } catch (e: any) {
      console.error('Failed to fetch incoming requests:', e);
    }
  };

  const fetchOutgoingRequests = async () => {
    if (!token) return;
    try {
      const outgoingUrl = `${API_URL}/api/matching/chat_requests/outgoing`;
      console.log('[DEBUG] Fetching outgoing requests from:', outgoingUrl);
      const res = await fetch(outgoingUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      console.log('[DEBUG] Outgoing requests response status:', res.status);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      console.log('[DEBUG] Outgoing requests data:', data);
      setOutgoingRequests(data.items || []);
    } catch (e: any) {
      console.error('[DEBUG] Outgoing requests fetch error:', e);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchIncomingRequests();
    fetchOutgoingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // PCのみ自動選択（モバイルは手動選択）
    const isMobile = window.innerWidth < 768;
    if (!id && !requestId && !loading && !isMobile) {
      if (chats.length > 0) {
        navigate(`/matching/chats/${chats[0].chat_id}`, { replace: true });
      } else if (incomingRequests.length > 0) {
        navigate(`/matching/chats/requests/${incomingRequests[0].request_id}`, { replace: true });
      } else if (outgoingRequests.length > 0) {
        navigate(`/matching/chats/requests/${outgoingRequests[0].request_id}`, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, incomingRequests, outgoingRequests, loading, id, requestId]);

  const selectedChatId = id ? Number(id) : null;

  // チャットを最新順にソート
  const sortedChats = [...chats].sort((a, b) => {
    const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return timeB - timeA;
  });

  // 未ログインの場合は会員登録を促す
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Lock className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">有料会員限定機能</h2>
        <p className="text-gray-600 mb-6 text-center">
          チャット機能は有料会員のみご利用いただけます。
        </p>
        <button
          onClick={() => navigate('/register')}
          className="px-8 py-3 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 font-medium"
        >
          有料会員になる
        </button>
      </div>
    );
  }

  // 有料会員でない場合はアップグレード画面を表示
  if (!isPaidUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Lock className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">有料会員限定機能</h2>
        <p className="text-gray-600 mb-6 text-center">
          チャット機能は有料会員のみご利用いただけます。
        </p>
        <button
          onClick={() => navigate('/account')}
          className="px-8 py-3 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 font-medium"
        >
          有料会員になる
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] gap-4">
      {/* Left sidebar - Chat list */}
      <div className={`w-full md:w-64 flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white ${(id || requestId) ? 'hidden md:block' : 'block'}`}>
        <div className="p-4">
          <h2 className="text-lg font-semibold text-black mb-3">チャット</h2>
          
          {/* Incoming requests (received) */}
          {incomingRequests.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">受信リクエスト</h3>
              <div className="space-y-2">
                {incomingRequests.map((req) => (
                  <button
                    key={req.request_id}
                    onClick={() => navigate(`requests/${req.request_id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left border border-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {req.from_avatar_url ? (
                        <img
                          src={req.from_avatar_url.startsWith('http') ? req.from_avatar_url : `${API_URL}${req.from_avatar_url}`}
                          alt={req.from_display_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-2xl">😊</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{req.from_display_name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {req.initial_message || 'メールリクエスト'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing requests (sent, pending approval) */}
          {outgoingRequests.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">送信済みリクエスト（承諾待ち）</h3>
              <div className="space-y-2">
                {outgoingRequests.map((req) => (
                  <button
                    key={req.request_id}
                    onClick={() => navigate(`requests/${req.request_id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 text-left border border-gray-200 bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {req.to_avatar_url ? (
                        <img
                          src={req.to_avatar_url.startsWith('http') ? req.to_avatar_url : `${API_URL}${req.to_avatar_url}`}
                          alt={req.to_display_name || 'ユーザー'}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-2xl">😊</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{req.to_display_name || 'ユーザー'}</div>
                      <div className="text-xs text-gray-600 truncate">
                        ⏳ 承諾待ち
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active chats */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">チャット</h3>
            {loading && <div className="text-sm text-gray-500">読み込み中...</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="space-y-2">
              {sortedChats.map((chat) => (
                <button
                  key={chat.chat_id}
                  onClick={() => navigate(`/matching/chats/${chat.chat_id}`)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors relative ${
                    selectedChatId === chat.chat_id ? 'bg-gray-100 border-l-4 border-black' : 'hover:bg-gray-50 border border-gray-100'
                  }`}
                >
                  <div className="flex-shrink-0 relative">
                    {chat.with_avatar_url ? (
                      <img
                        src={chat.with_avatar_url.startsWith('http') ? chat.with_avatar_url : `${API_URL}${chat.with_avatar_url}`}
                        alt={chat.with_display_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-2xl">😊</span>
                      </div>
                    )}
                    {chat.unread_count && chat.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {chat.unread_count > 9 ? '9+' : chat.unread_count}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{chat.with_display_name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {chat.last_message || 'メッセージはまだありません'}
                    </div>
                  </div>
                </button>
              ))}
              {!loading && !error && chats.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">
                  チャットはまだありません
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Chat detail */}
      <div className={`flex-1 overflow-hidden ${!(id || requestId) ? 'hidden md:block' : 'block'}`}>
        <Outlet />
      </div>
    </div>
  );
};

export default MatchingChatShell;
