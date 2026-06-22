import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, Upload, Youtube, Tag, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { Post } from '../types/Post';

interface NewPostFormProps {
  categoryKey: string;
  onPostCreated: (post: Post) => void;
  onCancel: () => void;
  editingPost?: Post | null;
}

const categories = {
  board: { title: "掲示板", emoji: "💬", desc: "悩み相談や雑談、生活の話題" },
  art: { title: "アート", emoji: "🎨", desc: "イラスト・写真・映像作品の発表" },
  music: { title: "音楽", emoji: "🎵", desc: "お気に入りや自作・AI曲の共有" },
  shops: { title: "お店", emoji: "🏬", desc: "LGBTQフレンドリーなお店紹介" },
  tourism: { title: "ツーリズム", emoji: "📍", desc: "会員ガイドの交流型ツアー" },
  comics: { title: "コミック・映画", emoji: "🎬", desc: "LGBTQ+テーマの作品レビューと感想" },
  news: { title: "ニュース", emoji: "📰", desc: "最新の制度・条例情報と解説記事" },
  food: { title: "食レポ", emoji: "🍽️", desc: "単品メニュー・市販品のレビュー" },
  beauty: { title: "美容", emoji: "💄", desc: "コスメ・スキンケアのレビュー" },
  funding: { title: "寄付金を募る", emoji: "🤝", desc: "LGBTQ+コミュニティの仲間を支援" },
};

const subcategories: Record<string, string[]> = {
  board: ['悩み相談（カミングアウト／学校生活／職場環境）', '求人募集', '法律・手続き関係', '講座・勉強会', 'その他'],
  music: ['ジャズ', 'Jポップ', 'ポップス', 'R&B', 'ロック', 'AOR', 'クラシック', 'Hip-Hop', 'ラップ', 'ファンク', 'レゲエ', 'ワールド・ミュージック', 'AI生成音楽', 'その他'],
  shops: ['アパレル・ブティック', '雑貨店', 'レストラン・バー', '美容室・メイク', 'その他'],
  food: ['料理・食品', '飲食店', 'ブティック', '雑貨店', 'バー', 'サロン', 'ライブハウス'],
  tourism: [],
  comics: ['映画', 'コミック', 'TVドラマ', '同人誌', 'その他'],
  art: []
};

const prefectures = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

const NewPostForm: React.FC<NewPostFormProps> = ({
  categoryKey,
  onPostCreated,
  onCancel,
  editingPost,
}) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    title: editingPost?.title || '',
    body: editingPost?.body || '',
    tags: '',
    images: [] as File[],
    youtubeUrl: editingPost?.youtube_url || '',
    subcategory: editingPost?.subcategory || '',
    prefecture: editingPost?.prefecture || '',
    eventDate: editingPost?.event_date || '',
    fee: editingPost?.fee || '',
  });
  const [linkUrl, setLinkUrl] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'members' | 'followers' | 'private'>('public');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStartTime, setSubmitStartTime] = useState<number | null>(null);
  const category = categories[categoryKey as keyof typeof categories];

  const getLinkHostname = (url: string): string | null => {
    try {
      if (!url) return null;
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname;
    } catch {
      return null;
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData({ ...formData, images: [...formData.images, ...files] });
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  const extractYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.body.trim()) {
      newErrors.body = '投稿内容は必須です';
    } else if (formData.body.length > 2000) {
      newErrors.body = '投稿内容は2000文字以内で入力してください';
    }

    if (formData.title && formData.title.length > 80) {
      newErrors.title = 'タイトルは80文字以内で入力してください';
    }

    if ((categoryKey === 'music' || categoryKey === 'comics' || categoryKey === 'art') && formData.youtubeUrl) {
      if (!extractYouTubeVideoId(formData.youtubeUrl)) {
        newErrors.youtubeUrl = '有効なYouTube URLを入力してください';
      }
    }

    if ((categoryKey === 'board' || categoryKey === 'art' || categoryKey === 'shops' || categoryKey === 'tourism' || categoryKey === 'comics' || categoryKey === 'news' || categoryKey === 'food' || categoryKey === 'beauty') && formData.images.length > 0) {
      if (formData.images.length > 5) {
        newErrors.images = '画像は5枚まで選択できます';
      } else {
        for (const image of formData.images) {
          if (image.size > 10 * 1024 * 1024) {
            newErrors.images = '画像ファイルは10MB以下にしてください';
            break;
          }
          if (!image.type.startsWith('image/')) {
            newErrors.images = '画像ファイルのみアップロード可能です';
            break;
          }
        }
      }
    }

    if (submitStartTime && Date.now() - submitStartTime < 3000) {
      newErrors.spam = '投稿が早すぎます。少し待ってから再度お試しください。';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!submitStartTime) {
      setSubmitStartTime(Date.now());
    }
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      console.debug('[NewPostForm] submit start', { categoryKey, API_URL, hasToken: !!token });
      let mediaId: number | null = null;
      let uploadResult: any = null;
      
      if (formData.images.length > 0) {
        const imageFormData = new FormData();
        imageFormData.append('file', formData.images[0]);
        
        const uploadResponse = await fetch(`${API_URL}/api/media/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: imageFormData,
        });
        
        if (uploadResponse.ok) {
          uploadResult = await uploadResponse.json();
          mediaId = uploadResult.id;
        } else {
          const errText = await uploadResponse.text().catch(() => '');
          console.error('[NewPostForm] Image upload failed', uploadResponse.status, errText);
          setErrors({ submit: `画像アップロードに失敗しました (status ${uploadResponse.status})` });
          return;
        }
      }

      const bodyWithLink = linkUrl.trim()
        ? `${formData.body} #${categoryKey}\n\nリンク: ${linkUrl.trim()}`
        : `${formData.body} #${categoryKey}`;

      const postData: any = {
        title: formData.title || null,
        body: bodyWithLink,
        category: categoryKey,
        visibility: visibility,
        youtube_url: formData.youtubeUrl || null,
        media_id: mediaId,
        subcategory: formData.subcategory || null,
      };

      // ツーリズムの場合はtourism_detailsオブジェクトに含める
      if (categoryKey === 'tourism') {
        postData.post_type = 'tourism';
        postData.tourism_details = {
          prefecture: formData.prefecture || null,
          event_datetime: formData.eventDate ? new Date(formData.eventDate).toISOString() : null,
          fee: formData.fee ? parseInt(formData.fee) : null,
        };
      }

      const isEditing = !!editingPost;
      const url = isEditing ? `${API_URL}/api/posts/${editingPost.id}` : `${API_URL}/api/posts`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(postData),
      });

      if (response.ok) {
        const newPost = await response.json();
        const enhancedPost: Post = {
          ...newPost,
          media_url: uploadResult?.url || undefined,
          youtube_url: formData.youtubeUrl || undefined,
          like_count: 0,
          comment_count: 0,
          points: 10,
          is_liked: false,
          tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        };
        
        onPostCreated(enhancedPost);
        
        setFormData({
          title: '',
          body: '',
          tags: '',
          images: [],
          youtubeUrl: '',
          subcategory: '',
          prefecture: '',
          eventDate: '',
          fee: '',
        });
        setSubmitStartTime(null);
      } else {
        let errorDetail = '';
        try {
          const errorData = await response.json();
          errorDetail = errorData?.detail || '';
        } catch (_e) {
          errorDetail = await response.text().catch(() => '');
        }
        console.error('[NewPostForm] Create post failed', response.status, errorDetail);
        setErrors({ submit: errorDetail || `投稿の作成に失敗しました (status ${response.status})` });
      }
    } catch (error) {
      console.error('Error creating post:', error);
      setErrors({ submit: '投稿の作成に失敗しました' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border border-gray-200 shadow-xl bg-white">
      <CardHeader className="bg-white border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{category?.emoji}</div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {category?.title}に投稿
              </h3>
              <p className="text-sm text-gray-600">{category?.desc}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label="閉じる">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              タイトル（任意）
            </label>
            <Input
              placeholder="投稿のタイトルを入力..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
              maxLength={80}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.title && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.title}
                </p>
              )}
              <p className="text-xs text-gray-500 ml-auto">
                {formData.title.length}/80文字
              </p>
            </div>
          </div>

          {subcategories[categoryKey as keyof typeof subcategories]?.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                サブカテゴリー
              </label>
              <Select 
                value={formData.subcategory} 
                onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
              >
                <SelectTrigger className="border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                  <SelectValue placeholder="選択してください..." />
                </SelectTrigger>
                <SelectContent>
                  {subcategories[categoryKey as keyof typeof subcategories].map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {categoryKey === 'tourism' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  開催地域 <span className="text-red-500">*</span>
                </label>
                <Select 
                  value={formData.prefecture} 
                  onValueChange={(value) => setFormData({ ...formData, prefecture: value })}
                >
                  <SelectTrigger className="border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                    <SelectValue placeholder="都道府県を選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {prefectures.map((pref) => (
                      <SelectItem key={pref} value={pref}>
                        {pref}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  開催日 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  会費
                </label>
                <Input
                  type="text"
                  placeholder="例: 3,000円"
                  value={formData.fee}
                  onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                  className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  会費がある場合は金額を入力してください
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              投稿内容 <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="投稿内容を入力してください..."
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              className="border-gray-300 focus:border-gray-500 focus:ring-gray-500 min-h-[120px]"
              required
              maxLength={2000}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.body && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.body}
                </p>
              )}
              <p className="text-xs text-gray-500 ml-auto">
                {formData.body.length}/2000文字
              </p>
            </div>
          </div>

          {(categoryKey === 'music' || categoryKey === 'comics' || categoryKey === 'art') && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-500" />
                YouTube動画URL（任意）
              </label>
              <p className="text-xs text-gray-500 -mt-2">YouTubeのURLを貼り付けると、動画が再生できるようになります</p>
              <div className="relative">
                <Youtube className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={formData.youtubeUrl}
                  onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                  className="pl-10 border-red-200 focus:border-red-400 focus:ring-red-400"
                />
              </div>
              {formData.youtubeUrl && extractYouTubeVideoId(formData.youtubeUrl) && (
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeVideoId(formData.youtubeUrl)}`}
                      title="YouTube video preview"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    ></iframe>
                  </div>
                </div>
              )}
              {formData.youtubeUrl && !extractYouTubeVideoId(formData.youtubeUrl) && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  有効なYouTube URLを入力してください
                </p>
              )}
              {errors.youtubeUrl && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.youtubeUrl}
                </p>
              )}
            </div>
          )}

          {(categoryKey === 'board' || categoryKey === 'shops' || categoryKey === 'tourism' || categoryKey === 'comics' || categoryKey === 'news' || categoryKey === 'food' || categoryKey === 'beauty' || categoryKey === 'art') && (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                画像をアップロード（最大5枚）
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors bg-gray-50">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <Upload className="h-10 w-10 text-gray-500 mb-3" />
                  <span className="text-sm font-medium text-gray-700 mb-1">
                    クリックして画像を選択
                  </span>
                  <span className="text-xs text-gray-500">
                    PNG, JPG, GIF (最大10MB、5枚まで)
                  </span>
                </label>
              </div>
              {formData.images.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {formData.images.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`アップロード画像 ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute -top-2 -right-2 bg-black text-white rounded-full w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                        aria-label={`画像${index + 1}を削除`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      {index === 0 && (
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                          メイン
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {errors.images && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.images}
                </p>
              )}
            </div>
          )}

          {/* リンクURL（任意） */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              リンクURL（任意）
            </label>
            <Input
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
              type="url"
            />
            {getLinkHostname(linkUrl) && (
              <div className="mt-2 flex items-center gap-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${getLinkHostname(linkUrl)}`}
                  alt="サイトアイコン"
                  className="w-5 h-5 rounded"
                />
                <a
                  href={linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 text-gray-800 truncate"
                >
                  {getLinkHostname(linkUrl)} を開く
                </a>
              </div>
            )}
          </div>



          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              タグ（任意）
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="タグをカンマ区切りで入力（例：悩み相談, 初心者向け）"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="pl-10 border-gray-300 focus:border-gray-500 focus:ring-gray-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              タグを付けることで、同じ興味を持つ人に見つけてもらいやすくなります
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              この投稿を見ることができる人
            </label>
            <Select value={visibility} onValueChange={(value) => setVisibility(value as typeof visibility)}>
              <SelectTrigger className="border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">🌍 公開 - 誰でも見ることができます</SelectItem>
                <SelectItem value="members">👥 メンバーのみ - 登録ユーザーのみ</SelectItem>
                <SelectItem value="followers">👤 フォロワー - あなたをフォローしている人</SelectItem>
                <SelectItem value="private">🔒 非公開 - あなたのみ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(errors.submit || errors.spam) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-600">
                  {errors.submit || errors.spam}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button
              type="submit"
              className="bg-gradient-to-r from-black to-gray-800 hover:from-gray-900 hover:to-black text-white flex-1"
              disabled={isSubmitting || !formData.body.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  投稿中...
                </>
              ) : (
                '投稿する'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default NewPostForm;
