import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ArrowLeft, X, Upload } from 'lucide-react';
import { API_URL } from '../../config';

interface SalonCategory {
  id: number;
  display_name: string;
  group_name: string;
  icon: string | null;
}

const AUDIENCE_OPTIONS = [
  { value: '全員', label: '全員', badge: 'ALL' },
  { value: 'ゲイ', label: 'ゲイ', badge: 'G' },
  { value: 'レズビアン', label: 'レズビアン', badge: 'L' },
  { value: 'バイセクシュアル', label: 'バイセクシュアル', badge: 'B' },
  { value: 'トランスジェンダー', label: 'トランスジェンダー', badge: 'T' },
  { value: 'ノンバイナリー', label: 'ノンバイナリー', badge: 'NB' },
  { value: 'クエスチョニング', label: 'クエスチョニング', badge: 'Q' },
  { value: 'アライ', label: 'アライ', badge: 'A' },
  { value: 'その他', label: 'その他', badge: '他' },
];

const CreateSalonRoomPage: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCategory = searchParams.get('category');

  const [categories, setCategories] = useState<SalonCategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(preselectedCategory ? Number(preselectedCategory) : null);
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [theme, setTheme] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudiences, setTargetAudiences] = useState<string[]>(['全員']);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/api/salon/categories`);
        if (res.ok) setCategories(await res.json());
      } catch (err) {
        console.error(err);
      }
    };
    fetchCategories();
  }, []);

  const handleAudienceToggle = (value: string) => {
    if (value === '全員') {
      setTargetAudiences(['全員']);
      return;
    }
    setTargetAudiences(prev => {
      const filtered = prev.filter(v => v !== '全員');
      if (filtered.includes(value)) {
        const result = filtered.filter(v => v !== value);
        return result.length === 0 ? ['全員'] : result;
      }
      return [...filtered, value];
    });
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setThumbnailPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!thumbnailFile || !token) return null;
    const formData = new FormData();
    formData.append('file', thumbnailFile);
    try {
      const res = await fetch(`${API_URL}/api/media/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.trim() || !description.trim()) {
      setError('タイトルと説明文は必須です。');
      return;
    }
    if (newCategoryMode && !newCategoryName.trim()) {
      setError('新しいカテゴリー名を入力してください。');
      return;
    }
    if (!newCategoryMode && !categoryId) {
      setError('カテゴリーを選択してください。');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let resolvedCategoryId = categoryId;
      if (newCategoryMode) {
        const catRes = await fetch(`${API_URL}/api/salon/user-categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ display_name: newCategoryName.trim() }),
        });
        if (!catRes.ok) {
          const data = await catRes.json();
          setError(data.detail || 'カテゴリーの作成に失敗しました。');
          setSubmitting(false);
          return;
        }
        const catData = await catRes.json();
        resolvedCategoryId = catData.id;
      }

      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        thumbnailUrl = await uploadImage();
        if (!thumbnailUrl) {
          setError('画像のアップロードに失敗しました。もう一度お試しください。');
          setSubmitting(false);
          return;
        }
      }

      const res = await fetch(`${API_URL}/api/salon/v2/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          theme: theme.trim(),
          description: description.trim(),
          category_id: resolvedCategoryId,
          target_audiences: targetAudiences,
          visibility: targetAudiences.includes('全員') ? 'public' : 'restricted',
          tags: tags.length > 0 ? tags : null,
          thumbnail_url: thumbnailUrl,
        }),
      });
      if (res.ok) {
        const room = await res.json();
        navigate(`/salon/rooms/${room.id}`);
      } else {
        const data = await res.json();
        setError(data.detail || '作成に失敗しました。');
      }
    } catch {
      setError('ネットワークエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>

        <h1 className="text-2xl font-serif font-bold text-gray-900 mb-6">サロン室を作成</h1>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-xl border border-gray-200 p-6">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリー *</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setNewCategoryMode(false)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  !newCategoryMode
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                既存から選択
              </button>
              <button
                type="button"
                onClick={() => setNewCategoryMode(true)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  newCategoryMode
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ＋ 新しいカテゴリーを作成
              </button>
            </div>
            {!newCategoryMode ? (
              <select
                value={categoryId || ''}
                onChange={e => setCategoryId(Number(e.target.value) || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-800 focus:border-transparent"
              >
                <option value="">カテゴリーを選択</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.display_name}
                  </option>
                ))}
              </select>
            ) : (
              <div>
                <Input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="例: 昭和歌謡、韓国ドラマ、大阪グルメ（2〜30文字）"
                  maxLength={30}
                />
                <p className="text-xs text-gray-400 mt-1">{newCategoryName.length}/30文字 ※既存カテゴリーと同名の場合は自動的に統合されます</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">サロン室タイトル *</label>
            <Input
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="例: LGBTQ+当事者の恋愛や暮らしを語る部屋"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">説明文 *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="サロン室の説明を入力してください"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none"
            />
          </div>

          {/* Thumbnail Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">イメージ画像</label>
            <div className="flex items-center gap-4">
              {thumbnailPreview ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                  <img src={thumbnailPreview} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors">
                  <Upload className="h-5 w-5 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-400">画像選択</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
              <p className="text-xs text-gray-400">JPEG, PNG, WEBP（最大10MB）</p>
            </div>
          </div>

          {/* Target Audiences (merged with visibility) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">公開範囲</label>
            <p className="text-xs text-gray-400 mb-3">
              選択したセクシュアリティに該当する会員のみ入室できます。「全員」を選ぶと全会員に公開されます。
            </p>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleAudienceToggle(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    targetAudiences.includes(opt.value)
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">タグ</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="タグを入力してEnter"
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addTag}>追加</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} className="ml-1 text-gray-400 hover:text-gray-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-black hover:bg-gray-800 text-white py-3"
          >
            {submitting ? '作成中...' : 'サロン室を作成する'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CreateSalonRoomPage;
