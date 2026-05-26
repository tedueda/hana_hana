import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ArrowLeft, X } from 'lucide-react';
import { API_URL } from '../../config';

interface SalonCategory {
  id: number;
  display_name: string;
  group_name: string;
  icon: string | null;
}

const TARGET_AUDIENCE_OPTIONS = [
  { value: '全員', label: '全員' },
  { value: 'ゲイ', label: 'ゲイ' },
  { value: 'レズビアン', label: 'レズビアン' },
  { value: 'バイセクシュアル', label: 'バイセクシュアル' },
  { value: 'トランスジェンダー', label: 'トランスジェンダー' },
  { value: 'ノンバイナリー', label: 'ノンバイナリー' },
  { value: 'クエスチョニング', label: 'クエスチョニング' },
  { value: 'アライ', label: 'アライ' },
  { value: 'その他', label: 'その他' },
];

const CreateSalonRoomPage: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCategory = searchParams.get('category');

  const [categories, setCategories] = useState<SalonCategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(preselectedCategory ? Number(preselectedCategory) : null);
  const [theme, setTheme] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [targetAudiences, setTargetAudiences] = useState<string[]>(['全員']);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !theme.trim() || !description.trim()) {
      setError('カテゴリー、タイトル、説明文は必須です。');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/salon/v2/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          theme: theme.trim(),
          description: description.trim(),
          category_id: categoryId,
          target_audiences: targetAudiences,
          visibility,
          tags: tags.length > 0 ? tags : null,
        }),
      });
      if (res.ok) {
        const room = await res.json();
        navigate(`/salon/rooms/${room.id}`);
      } else {
        const data = await res.json();
        setError(data.detail || '作成に失敗しました。');
      }
    } catch (err) {
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
            <select
              value={categoryId || ''}
              onChange={e => setCategoryId(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-800 focus:border-transparent"
            >
              <option value="">カテゴリーを選択</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.display_name}（{cat.group_name}）
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">サロン室タイトル *</label>
            <Input
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="例: 読売ジャイアンツを応援する部屋"
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

          {/* Target Audiences */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">おすすめ対象</label>
            <div className="flex flex-wrap gap-2">
              {TARGET_AUDIENCE_OPTIONS.map(opt => (
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

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">公開範囲</label>
            <div className="flex gap-3">
              {[
                { value: 'public', label: '全会員に公開' },
                { value: 'invite', label: '招待制' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    visibility === opt.value
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
