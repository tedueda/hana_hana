import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MessageCircle, Send, Camera, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Post, Comment, PostWithTranslation } from '../types/Post';
import LikeButton from '../components/common/LikeButton';
import { compressImage } from '../utils/imageCompression';
import TranslationToggle from '../components/common/TranslationToggle';
import { fetchPostWithTranslation } from '../services/translationService';
import { getPreferredLanguage } from '../utils/languageUtils';
import { API_URL } from '../config';
import { detectExternalEmbed } from '../utils/embedExtractors';
import OgpLinkPreview from '../components/common/OgpLinkPreview';

const formatNumber = (num: number): string => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

const getRelativeTime = (dateString: string, t: (key: string, options?: Record<string, unknown>) => string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return t('time.now');
  if (diffInSeconds < 3600) return t('time.minutesAgo', { count: Math.floor(diffInSeconds / 60) });
  if (diffInSeconds < 86400) return t('time.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
  if (diffInSeconds < 2592000) return t('time.daysAgo', { count: Math.floor(diffInSeconds / 86400) });
  return date.toLocaleDateString();
};

const getCategoryPlaceholder = (category: string | undefined): string => {
  const categoryMap: { [key: string]: string } = {
    'board': '/assets/placeholders/board.svg',
    'art': '/assets/placeholders/art.svg',
    'music': '/assets/placeholders/music.svg',
    'shops': '/assets/placeholders/shops.svg',
    'tourism': '/assets/placeholders/tourism.svg',
    'comics': '/assets/placeholders/comics.svg',
  };
  return categoryMap[category || 'board'] || '/assets/placeholders/board.svg';
};

const getYouTubeEmbedUrl = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    let videoId = '';
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      videoId = urlObj.searchParams.get('v') || '';
    } else if (urlObj.hostname === 'youtu.be') {
      const pathParts = urlObj.pathname.slice(1).split('?');
      videoId = pathParts[0];
    } else if (urlObj.hostname === 'm.youtube.com') {
      videoId = urlObj.searchParams.get('v') || '';
    }
    videoId = videoId.split('?')[0].split('&')[0].split('/')[0];
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    }
  } catch (error) {
    console.error('Invalid YouTube URL:', error);
  }
  return '';
};

const extractYouTubeUrl = (text: string): string | null => {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/;
  const match = text.match(youtubeRegex);
  if (match) {
    return `https://www.youtube.com/watch?v=${match[1]}`;
  }
  return null;
};

const getLinkHostname = (url: string): string | null => {
  try {
    if (!url) return null;
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
};

const extractFirstUrl = (text: string): string | null => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+)/;
  const match = text.match(urlRegex);
  return match ? match[1] : null;
};

const PostDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { token, user: currentUser, isAnonymous, isLoading: authLoading } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [postUser, setPostUser] = useState<{ display_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showFullText, setShowFullText] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [translatedPost, setTranslatedPost] = useState<PostWithTranslation | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(true);
  const [viewLang, setViewLang] = useState<string>(getPreferredLanguage());

  useEffect(() => {
    if (!id) return;
    const fetchPost = async () => {
      try {
        setLoading(true);
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${API_URL}/api/posts/${id}`, { headers });
        if (!response.ok) {
          setError(t('post.notFound'));
          return;
        }
        const data = await response.json();
        setPost(data);
        setIsLiked(data.is_liked || false);
        setLikeCount(data.like_count || 0);
        setEditTitle(data.title || '');
        setEditBody(data.body || '');
        setPostUser({ display_name: data.user_display_name || '' });

        const commentsRes = await fetch(`${API_URL}/api/posts/${id}/comments`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (commentsRes.ok) {
          setComments(await commentsRes.json());
        }
      } catch {
        setError(t('common.networkError'));
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id, token]);

  const fetchTranslation = async (targetLang?: string) => {
    if (!post) return;
    const userLang = targetLang || currentLanguage;
    setViewLang(userLang);
    if (post.original_lang === userLang) {
      setTranslatedPost(null);
      setShowTranslated(false);
      return;
    }
    try {
      setIsTranslating(true);
      setTranslationError(null);
      const translated = await fetchPostWithTranslation(post.id, userLang as any, 'translated');
      setTranslatedPost(translated);
      setShowTranslated(translated.is_translated);
    } catch {
      setTranslationError(t('translation.translationFailed'));
      setShowTranslated(false);
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    if (post) {
      fetchTranslation(currentLanguage);
    }
  }, [post?.id, currentLanguage]);

  const handleTranslationToggle = () => setShowTranslated(!showTranslated);

  const displayTitle = showTranslated && translatedPost?.is_translated
    ? translatedPost.display_title
    : post?.title;

  const displayBody = showTranslated && translatedPost?.is_translated
    ? translatedPost.display_text
    : post?.body;

  const currentUserId = currentUser?.id != null ? Number(currentUser.id) : null;
  const postAuthorId = post?.user_id != null ? Number(post.user_id) : null;
  const canEdit = !authLoading && !!currentUser && !isAnonymous && currentUserId != null && postAuthorId != null && currentUserId === postAuthorId;
  const linkUrlFromBody = extractFirstUrl(post?.body || '');

  const handleAddComment = async () => {
    if (!newComment.trim() || !token || !post) return;
    try {
      const response = await fetch(`${API_URL}/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          authorName: currentUser?.display_name || 'Anonymous',
          body: newComment,
        }),
      });
      if (response.ok) {
        const newCommentData = await response.json();
        const updatedComments = [...comments, {
          ...newCommentData,
          user: { id: currentUser?.id || 0, display_name: currentUser?.display_name || '' }
        }];
        setComments(updatedComments);
        setNewComment('');
        setPost(prev => prev ? { ...prev, comment_count: updatedComments.length } : prev);
      }
    } catch {
      const optimisticComment: Comment = {
        id: Date.now(),
        body: newComment,
        created_at: new Date().toISOString(),
        user: { id: currentUser?.id || 0, display_name: currentUser?.display_name || '' }
      };
      setComments(prev => [...prev, optimisticComment]);
      setNewComment('');
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadError(null);
    if (file) {
      if (!file.type.startsWith('image/')) { setUploadError(t('post.selectImageFile')); return; }
      if (file.size > 10 * 1024 * 1024) { setUploadError(t('post.imageSizeLimit')); return; }
      try {
        setIsUploadingImage(true);
        const compressedFile = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.85, maxSizeMB: 2 });
        setNewImageFile(compressedFile);
        setNewImagePreview(URL.createObjectURL(compressedFile));
        setRemoveCurrentImage(false);
      } catch {
        setUploadError(t('post.imageProcessingFailed'));
      } finally {
        setIsUploadingImage(false);
      }
    } else {
      setNewImageFile(null);
      setNewImagePreview(null);
    }
  };

  const handleRemoveImageToggle = () => {
    setRemoveCurrentImage(prev => !prev);
    if (!removeCurrentImage) {
      setNewImageFile(null);
      setNewImagePreview(null);
    }
  };

  const uploadNewImageIfNeeded = async (): Promise<{ mediaId: number | null; mediaUrl?: string } | null> => {
    if (!token) return { mediaId: null };
    if (!newImageFile) return null;
    try {
      setIsUploadingImage(true);
      const fd = new FormData();
      fd.append('file', newImageFile);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      try {
        const res = await fetch(`${API_URL}/api/media/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) { setUploadError(t('post.imageUploadFailed')); return { mediaId: null }; }
        const data = await res.json();
        return { mediaId: data.id, mediaUrl: data.url as string };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') setUploadError(t('post.uploadTimeout'));
        else throw fetchError;
        return { mediaId: null };
      }
    } catch (e: any) {
      setUploadError(e?.message || t('post.imageUploadFailed'));
      return { mediaId: null };
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUpdatePost = async () => {
    if (!token || !post) return;
    try {
      let mediaIdToSet: number | null | undefined = undefined;
      let mediaUrlToSet: string | undefined = undefined;
      if (removeCurrentImage) {
        mediaIdToSet = null;
      } else {
        const uploaded = await uploadNewImageIfNeeded();
        if (uploaded && uploaded.mediaId) {
          mediaIdToSet = uploaded.mediaId;
          mediaUrlToSet = uploaded.mediaUrl;
        }
      }
      const response = await fetch(`${API_URL}/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editTitle,
          body: editBody,
          ...(mediaIdToSet !== undefined ? { media_id: mediaIdToSet } : {}),
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        const patched = {
          ...updated,
          media_url: mediaUrlToSet !== undefined
            ? mediaUrlToSet
            : (removeCurrentImage ? undefined : (updated.media_url ?? post.media_url)),
        } as Post;
        setPost(patched);
        setIsEditing(false);
      }
    } catch (e) {
      console.error('Update error', e);
    }
  };

  const handleDeletePost = async () => {
    if (!token || !post) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const response = await fetch(`${API_URL}/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok || response.status === 204) {
        navigate(-1);
      } else {
        let text = '';
        try { text = await response.text(); } catch {}
        setDeleteError(text || t('post.deleteFailed'));
      }
    } catch (e: any) {
      setDeleteError(e?.message || t('common.networkError'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">{error || t('post.notFound')}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>

          {!isAnonymous && currentUser && (
            <Button
              variant="outline"
              onClick={() => navigate(`/create/${post.category || ''}`)}
              className="bg-white text-gray-900 hover:bg-gray-100"
            >
              <Plus className="h-4 w-4 mr-2" />
              新規投稿
            </Button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-sm">
                  {(postUser?.display_name || post.user_display_name || '?').charAt(0)}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  {postUser?.display_name || post.user_display_name || ''}
                </h3>
                <p className="text-xs text-gray-500">
                  {getRelativeTime(post.created_at, t)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-pink-700 border-pink-300 hover:bg-pink-50"
                        onClick={handleUpdatePost}
                      >
                        {t('common.save')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() => {
                          setIsEditing(false);
                          setEditTitle(post.title || '');
                          setEditBody(post.body || '');
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-pink-700 hover:text-pink-900"
                        onClick={() => setIsEditing(true)}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={handleDeletePost}
                        disabled={isDeleting}
                      >
                        {isDeleting ? t('post.deleting') : t('common.delete')}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {deleteError && (
            <div className="mx-4 mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {deleteError}
            </div>
          )}

          {(post.media_url || (post.media_urls && post.media_urls.length > 0)) && (
            <div className="relative">
              <div className="aspect-[3/2] bg-gray-100 flex items-center justify-center">
                {isEditing ? (
                  <>
                    {newImagePreview ? (
                      <img src={newImagePreview} alt={t('post.newImagePreview')} className="max-w-full max-h-full object-contain" />
                    ) : !removeCurrentImage ? (
                      <img
                        src={`${(() => {
                          const imageUrl = post.media_url || (post.media_urls && post.media_urls[currentImageIndex]);
                          if (!imageUrl) return '';
                          return imageUrl.startsWith('http') ? imageUrl :
                            (imageUrl.startsWith('/assets/') || imageUrl.startsWith('/images/')) ? imageUrl :
                            `${API_URL}${imageUrl}`;
                        })()}`}
                        alt={t('post.postImage')}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {t('post.imageWillBeDeleted')}
                      </div>
                    )}
                  </>
                ) : (
                  <img
                    src={`${(() => {
                      const imageUrl = post.media_url || (post.media_urls && post.media_urls[currentImageIndex]);
                      if (!imageUrl) return '';
                      return imageUrl.startsWith('http') ? imageUrl :
                        (imageUrl.startsWith('/assets/') || imageUrl.startsWith('/images/')) ? imageUrl :
                        `${API_URL}${imageUrl}`;
                    })()}`}
                    alt={t('post.postImage')}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
              {!isEditing && post.media_urls && post.media_urls.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2"
                    onClick={() => setCurrentImageIndex(prev => (prev === 0 ? post.media_urls!.length - 1 : prev - 1))}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2"
                    onClick={() => setCurrentImageIndex(prev => (prev === post.media_urls!.length - 1 ? 0 : prev + 1))}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {post.media_urls.map((_, index) => (
                      <button
                        key={index}
                        className={`w-2 h-2 rounded-full transition-all ${index === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                        onClick={() => setCurrentImageIndex(index)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {(post.youtube_url || extractYouTubeUrl(post.body)) ? (
            <div className="aspect-video w-full">
              <iframe
                src={getYouTubeEmbedUrl(post.youtube_url || extractYouTubeUrl(post.body) || '')}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full rounded-lg"
              />
            </div>
          ) : detectExternalEmbed(post.body) ? (
            (() => {
              const embed = detectExternalEmbed(post.body)!;
              if (embed.type === 'standfm') {
                return (
                  <div className="w-full h-[230px]">
                    <iframe
                      src={embed.embedUrl}
                      title="stand.fm player"
                      frameBorder="0"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      className="w-full h-full rounded-lg"
                      style={{ border: 0 }}
                    />
                  </div>
                );
              }
              // suno.ai はiframe非対応のためOGPプレビューで表示
              return <OgpLinkPreview url={embed.originalUrl} />;
            })()
          ) : linkUrlFromBody && !(post.media_url || (post.media_urls && post.media_urls[0])) ? (
            <OgpLinkPreview url={linkUrlFromBody} />
          ) : !(post.media_url || (post.media_urls && post.media_urls[0])) && (
            <div className="aspect-[3/2] bg-gray-100 flex items-center justify-center">
              <img
                src={getCategoryPlaceholder(post.category)}
                alt={t('post.category')}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          <div className="p-6">
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full border border-pink-200 rounded-md px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
                placeholder={t('post.title')}
              />
            ) : (
              displayTitle && (
                <h2 className="text-xl font-bold text-gray-900 mb-3">{displayTitle}</h2>
              )
            )}

            {!isEditing && (
              <div className="mb-3">
                <TranslationToggle
                  isTranslated={showTranslated && (translatedPost?.is_translated || false)}
                  isLoading={isTranslating}
                  hasTranslation={translatedPost?.has_translation || false}
                  originalLang={translatedPost?.original_lang || post.original_lang}
                  viewLang={viewLang}
                  onToggle={handleTranslationToggle}
                  error={translationError}
                />
              </div>
            )}

            {isEditing && (
              <div className="mb-4 space-y-2">
                <div className="text-sm font-medium text-gray-700">{t('post.postImage')}</div>
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="edit-image" className="inline-flex items-center gap-2 px-3 py-2 border border-pink-300 rounded-md text-sm text-pink-700 hover:bg-pink-50 cursor-pointer">
                    {t('post.selectImageFile')}
                  </label>
                  <input id="edit-image" type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
                  <label htmlFor="edit-camera" className="inline-flex items-center gap-2 px-3 py-2 border border-blue-300 rounded-md text-sm text-blue-700 hover:bg-blue-50 cursor-pointer">
                    <Camera className="h-4 w-4" />
                  </label>
                  <input id="edit-camera" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageFileChange} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`border-red-300 text-red-600 hover:bg-red-50 ${removeCurrentImage ? 'bg-red-50' : ''}`}
                    onClick={handleRemoveImageToggle}
                  >
                    {t('common.delete')}
                  </Button>
                  {isUploadingImage && <span className="text-xs text-gray-500">{t('common.loading')}</span>}
                  {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
                  {newImageFile && (
                    <span className="text-xs text-gray-500">
                      {newImageFile.name} ({(newImageFile.size / 1024).toFixed(0)}KB)
                    </span>
                  )}
                </div>
              </div>
            )}

            {!isEditing && post.category === 'tourism' && (
              <div className="mb-4 space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">{t('post.eventInfo')}</h4>
                {post.prefecture && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-gray-700 min-w-[80px]">{t('post.eventLocation')}:</span>
                    <span className="text-gray-800">{post.prefecture}</span>
                  </div>
                )}
                {post.event_date && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-gray-700 min-w-[80px]">{t('post.eventDate')}:</span>
                    <span className="text-gray-800">{new Date(post.event_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                )}
                {post.fee && (
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-gray-700 min-w-[80px]">{t('post.fee')}:</span>
                    <span className="text-gray-800">{post.fee}</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-gray-700 leading-7 mb-4">
              {isEditing ? (
                <Textarea
                  placeholder={t('post.bodyPlaceholder')}
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  className="border-pink-200 focus:border-pink-400 min-h-[140px]"
                  rows={6}
                />
              ) : (
                <>
                  {showFullText || (displayBody || '').length <= 500
                    ? displayBody
                    : `${(displayBody || '').substring(0, 500)}...`
                  }
                  {(displayBody || '').length > 500 && (
                    <Button
                      variant="link"
                      className="p-0 h-auto text-pink-600 hover:text-pink-700 ml-2"
                      onClick={() => setShowFullText(!showFullText)}
                    >
                      {showFullText ? t('post.showLess') : t('post.readMore')}
                    </Button>
                  )}
                </>
              )}
            </div>

            {!isEditing && linkUrlFromBody && getLinkHostname(linkUrlFromBody) && (
              <div className="mb-4 flex items-center gap-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${getLinkHostname(linkUrlFromBody)}`}
                  alt="icon"
                  className="w-5 h-5 rounded"
                />
                <a
                  href={linkUrlFromBody}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 text-gray-800 truncate"
                >
                  {getLinkHostname(linkUrlFromBody)}
                </a>
              </div>
            )}

            <div className="flex items-center gap-6 py-4 border-t border-gray-100">
              <LikeButton
                postId={post.id}
                initialLiked={isLiked}
                initialLikeCount={likeCount}
                onLikeChange={(liked, count) => {
                  setIsLiked(liked);
                  setLikeCount(count);
                }}
                token={token}
                apiUrl={API_URL}
                size="default"
                className="text-base"
                source="modal"
              />
              <div className="flex items-center gap-2 text-gray-600">
                <MessageCircle className="h-5 w-5" />
                <span className="font-medium">{t('post.comments')} {formatNumber(comments.length)}</span>
              </div>
              {post.points && (
                <div className="text-sm font-medium text-orange-600">
                  {formatNumber(post.points)}pt
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h4 className="font-semibold text-gray-900 mb-4">
                {t('post.comments')} ({formatNumber(comments.length)})
              </h4>

              {currentUser && !isAnonymous ? (
                <div className="mb-6">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-pink-100 to-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-pink-600 font-semibold text-sm">
                        {currentUser.display_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder={t('post.writeComment')}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        className="border-pink-200 focus:border-pink-400 min-h-[80px] resize-none"
                        rows={3}
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">{newComment.length}/1000</p>
                        <Button
                          onClick={handleAddComment}
                          size="sm"
                          className="bg-pink-600 hover:bg-pink-700 text-white"
                          disabled={!newComment.trim() || newComment.length > 1000}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          {t('common.send')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg mb-6">
                  <p className="text-sm text-gray-500 mb-3">{t('post.loginToComment')}</p>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white"
                    onClick={() => navigate('/login')}
                  >
                    {t('common.login')}
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">{t('post.beFirstToComment')}</p>
                  </div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="flex gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="w-8 h-8 bg-gradient-to-br from-pink-100 to-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-pink-600 font-semibold text-sm">
                          {comment.user?.display_name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {comment.user?.display_name || t('common.unknownUser')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {getRelativeTime(comment.created_at, t)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{comment.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetailPage;
