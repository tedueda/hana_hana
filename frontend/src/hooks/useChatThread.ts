import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL, DIRECT_API_URL } from '@/config';

export type Message = {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
  sender_display_name?: string;
};

type MessagesResponse = {
  items: Message[];
};

export function useChatThread(chatId: number | null, token: string | null, _currentUserId: number | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const messageMapRef = useRef<Map<number, Message>>(new Map());
  const mountedRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (!token || !chatId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/matching/chats/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data: MessagesResponse = await res.json();
      const fetchedMessages = data.items || [];
      
      messageMapRef.current.clear();
      fetchedMessages.forEach(msg => {
        messageMapRef.current.set(msg.id, msg);
      });
      
      setMessages(Array.from(messageMapRef.current.values()).sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ));
    } catch (e: any) {
      console.error('Failed to fetch messages:', e);
      setError(e?.message || 'メッセージの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [chatId, token]);

  const addMessage = useCallback((msg: Message) => {
    if (messageMapRef.current.has(msg.id)) {
      return;
    }
    
    messageMapRef.current.set(msg.id, msg);
    setMessages(Array.from(messageMapRef.current.values()).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!token || !chatId || !content.trim()) return;
    
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/matching/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: content.trim() }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const newMessage: Message = await res.json();
      addMessage(newMessage);
    } catch (e: any) {
      console.error('Failed to send message:', e);
      alert(`エラー: ${e?.message || 'メッセージ送信に失敗しました'}`);
    } finally {
      setSending(false);
    }
  }, [chatId, token, addMessage]);

  useEffect(() => {
    if (!chatId || !token) {
      setMessages([]);
      messageMapRef.current.clear();
      return;
    }

    if (mountedRef.current) {
      return;
    }
    mountedRef.current = true;

    fetchMessages();

    // メッセージを既読にする
    const markAsRead = async () => {
      try {
        await fetch(`${API_URL}/api/matching/chats/${chatId}/read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch (e) {
        console.debug('Failed to mark messages as read:', e);
      }
    };
    markAsRead();

    const websocketBaseUrl = API_URL || DIRECT_API_URL;
    const proto = websocketBaseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${proto}://${new URL(websocketBaseUrl).host}/ws/matching/chat?chat_id=${chatId}&token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.info('WebSocket connected for chat', chatId);
    };

    ws.onmessage = (event) => {
      try {
        const msg: Message = JSON.parse(event.data);
        addMessage(msg);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      // WebSocket接続エラーは静かに処理（403エラーは権限不足のため）
      console.debug('WebSocket connection failed (this is expected if chat access is restricted):', error);
    };

    ws.onclose = () => {
      console.info('WebSocket closed for chat', chatId);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      mountedRef.current = false;
    };
  }, [chatId, token, fetchMessages, addMessage]);

  return {
    messages,
    loading,
    error,
    sending,
    sendMessage,
    refetch: fetchMessages,
  };
}
