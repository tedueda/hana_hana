import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ArrowLeft, Send, Users, MessageSquare, Clock, ChevronDown, ChevronUp, Flag } from 'lucide-react';
import { API_URL } from '../../config';

const AUDIENCE_BADGE_MAP: Record<string, string> = {
  'ゲイ': 'G',
  'レズビアン': 'L',
  'バイセクシュアル': 'B',
  'トランスジェンダー': 'T',
  'ノンバイナリー': 'NB',
  'クエスチョニング': 'Q',
  'アライ': 'A',
  'その他': '他',
};

interface SalonRoom {
  id: number;
  category_id: number | null;
  category_name: string | null;
  theme: string;
  description: string;
  tags: string[];
  visibility: string;
  target_audiences: string[] | null;
  thumbnail_url: string | null;
  participant_count: number;
  post_count: number;
  creator_id: number;
  creator_display_name: string | null;
  created_at: string;
  last_post_at: string | null;
}

interface SalonPost {
  id: number;
  room_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  comment_count: number;
}

interface SalonComment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
}

const SalonRoomDetailPage: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [room, setRoom] = useState<SalonRoom | null>(null);
  const [posts, setPosts] = useState<SalonPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<number, SalonComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [submittingComment, setSubmittingComment] = useState<number | null>(null);

  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';

  const fetchRoom = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`${API_URL}/api/salon/v2/rooms/${roomId}`);
      if (res.ok) setRoom(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPosts = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`${API_URL}/api/salon/v2/rooms/${roomId}/posts?size=50`);
      if (res.ok) setPosts(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchRoom(), fetchPosts()]);
      setLoading(false);
    };
    load();
  }, [roomId]);

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || !token || !roomId) return;
    setSubmittingPost(true);
    try {
      const res = await fetch(`${API_URL}/api/salon/v2/rooms/${roomId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: newPostContent.trim() }),
      });
      if (res.ok) {
        setNewPostContent('');
        await fetchPosts();
        await fetchRoom();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPost(false);
    }
  };

  const toggleComments = async (postId: number) => {
    const next = new Set(expandedComments);
    if (next.has(postId)) {
      next.delete(postId);
    } else {
      next.add(postId);
      if (!commentsMap[postId]) {
        try {
          const res = await fetch(`${API_URL}/api/salon/v2/posts/${postId}/comments`);
          if (res.ok) {
            const data = await res.json();
            setCommentsMap(prev => ({ ...prev, [postId]: data }));
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
    setExpandedComments(next);
  };

  const handleCreateComment = async (postId: number) => {
    const content = commentInputs[postId]?.trim();
    if (!content || !token) return;
    setSubmittingComment(postId);
    try {
      const res = await fetch(`${API_URL}/api/salon/v2/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        const commentsRes = await fetch(`${API_URL}/api/salon/v2/posts/${postId}/comments`);
        if (commentsRes.ok) {
          const commentsData = await commentsRes.json();
          setCommentsMap(prev => ({ ...prev, [postId]: commentsData }));
        }
        await fetchPosts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(null);
    }
  };

  const handleReport = async (roomId?: number, postId?: number, commentId?: number) => {
    const reason = window.prompt('通報理由を入力してください');
    if (!reason || !token) return;
    try {
      await fetch(`${API_URL}/api/salon/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ room_id: roomId || null, post_id: postId || null, comment_id: commentId || null, reason }),
      });
      alert('通報を受け付けました。');
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">サロン室が見つかりません。</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <Button
          variant="ghost"
          onClick={() => room.category_id ? navigate(`/salon/category/${room.category_id}`) : navigate('/salon')}
          className="mb-4 text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {room.category_name || 'サロン一覧'}へ戻る
        </Button>

        {/* Room Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-serif font-bold text-gray-900">{room.theme}</h1>
                {room.target_audiences && !room.target_audiences.includes('全員') && room.target_audiences.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    {room.target_audiences.map(a => {
                      const badge = AUDIENCE_BADGE_MAP[a] || a.charAt(0);
                      return (
                        <span key={a} className="inline-flex items-center justify-center min-w-[24px] h-[24px] px-1 text-[11px] font-bold bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full">
                          {badge}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              {room.category_name && (
                <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mb-3">
                  {room.category_name}
                </span>
              )}
              <p className="text-gray-600 text-sm mb-4">{room.description}</p>
            </div>
            <button
              onClick={() => handleReport(room.id)}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              title="通報する"
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              投稿 {room.post_count}件
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              参加 {room.participant_count}人
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              作成 {formatDate(room.created_at)}
            </span>
            {room.creator_display_name && (
              <span>作成者: {room.creator_display_name}</span>
            )}
          </div>

          {room.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {room.tags.map(tag => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* New Post Form */}
        {isPaidUser && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <textarea
              ref={textareaRef}
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              placeholder="投稿を入力..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none mb-3"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleCreatePost}
                disabled={submittingPost || !newPostContent.trim()}
                className="bg-black hover:bg-gray-800 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                {submittingPost ? '投稿中...' : '投稿する'}
              </Button>
            </div>
          </div>
        )}

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">まだ投稿がありません。</p>
            <p className="text-gray-400 text-sm mt-1">最初の投稿を書いてみましょう。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <Card key={post.id} className="border border-gray-200">
                <CardContent className="p-5">
                  {/* Post header */}
                  <div className="flex items-center gap-3 mb-3">
                    {post.user_avatar_url ? (
                      <img src={post.user_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                        {(post.user_display_name || '?')[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{post.user_display_name || '匿名'}</span>
                      <span className="text-xs text-gray-400 ml-2">{formatDate(post.created_at)}</span>
                    </div>
                    <button
                      onClick={() => handleReport(undefined, post.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      title="通報する"
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Post content */}
                  <div className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{post.content}</div>

                  {/* Comment toggle */}
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    コメント {post.comment_count}件
                    {expandedComments.has(post.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {/* Comments section */}
                  {expandedComments.has(post.id) && (
                    <div className="mt-4 pl-4 border-l-2 border-gray-100">
                      {(commentsMap[post.id] || []).map(comment => (
                        <div key={comment.id} className="mb-3 last:mb-0">
                          <div className="flex items-center gap-2 mb-1">
                            {comment.user_avatar_url ? (
                              <img src={comment.user_avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-[10px] font-bold">
                                {(comment.user_display_name || '?')[0]}
                              </div>
                            )}
                            <span className="text-xs font-medium text-gray-700">{comment.user_display_name || '匿名'}</span>
                            <span className="text-[10px] text-gray-400">{formatDate(comment.created_at)}</span>
                            <button
                              onClick={() => handleReport(undefined, undefined, comment.id)}
                              className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                              title="通報する"
                            >
                              <Flag className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap pl-8">{comment.content}</p>
                        </div>
                      ))}

                      {/* Comment input */}
                      {isPaidUser && (
                        <div className="flex gap-2 mt-3">
                          <input
                            value={commentInputs[post.id] || ''}
                            onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreateComment(post.id); } }}
                            placeholder="コメントを入力..."
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleCreateComment(post.id)}
                            disabled={submittingComment === post.id || !commentInputs[post.id]?.trim()}
                            className="bg-black hover:bg-gray-800 text-white text-xs px-3"
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalonRoomDetailPage;
