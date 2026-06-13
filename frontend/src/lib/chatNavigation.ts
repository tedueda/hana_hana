import { NavigateFunction } from 'react-router-dom';
import { ApiClient, ApiError } from './apiClient';

type ChatItem = {
  chat_id: number;
  with_user_id: number;
  with_display_name: string;
  last_message?: string;
};

type ChatsResponse = {
  items: ChatItem[];
};

type ChatRequestResponse = {
  request_id: number;
  chat_id?: number;
};

/**
 * Checks if a chat already exists with the given user
 * @returns chat_id if exists, null otherwise
 */
export async function findExistingChat(
  apiClient: ApiClient,
  userId: number
): Promise<number | null> {
  try {
    const data = await apiClient.get<ChatsResponse>('/api/matching/chats');
    const existingChat = data.items?.find(
      (chat) => chat.with_user_id === userId
    );
    return existingChat ? existingChat.chat_id : null;
  } catch (error) {
    console.error('Failed to check existing chat:', error);
    return null;
  }
}

/**
 * Navigates to chat with user, creating a chat request if needed
 * Handles the "already_chatting" error gracefully
 */
export async function navigateToChat(
  apiClient: ApiClient,
  navigate: NavigateFunction,
  userId: number,
  initialMessage: string = '',
  currentUserId: number | null = null
): Promise<void> {
  if (currentUserId && userId === currentUserId) {
    alert('自分自身にはメッセージを送信できません');
    navigate('/matching/chats');
    return;
  }

  const existingChatId = await findExistingChat(apiClient, userId);
  if (existingChatId) {
    navigate(`/matching/chats/${existingChatId}`);
    return;
  }

  try {
    const data = await apiClient.post<ChatRequestResponse>(
      `/api/matching/chat_requests/${userId}`,
      { initial_message: initialMessage }
    );

    if (data.chat_id) {
      navigate(`/matching/chats/${data.chat_id}`, { replace: true });
    } else if (data.request_id) {
      navigate(`/matching/chats/requests/${data.request_id}`, { replace: true });
    } else {
      navigate('/matching/chats', { replace: true });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 400 && error.data?.detail?.includes('Cannot send chat request to yourself')) {
        alert('自分自身にはメッセージを送信できません');
        navigate('/matching/chats');
        return;
      }
      
      if (error.status === 409) {
        const chatId = error.data?.detail?.chat_id || error.data?.chat_id;
        if (chatId) {
          navigate(`/matching/chats/${chatId}`, { replace: true });
          return;
        }
      }
    }
    
    throw error;
  }
}

/**
 * Navigates directly to chat with user (creating chat if needed)
 * Use this for "チャットをする" buttons
 */
export async function navigateToComposeOrChat(
  apiClient: ApiClient,
  navigate: NavigateFunction,
  userId: number,
  currentUserId: number | null
): Promise<void> {
  await navigateToChat(apiClient, navigate, userId, '', currentUserId);
}
