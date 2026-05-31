import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Search, Trash2, Upload, Sparkles, Eye, Send, ChevronLeft, ChevronRight, LogOut, Pencil, Copy, QrCode, Download, Check, X } from 'lucide-react';
import { BACKEND_URL } from '@/config';

const AdminPage: React.FC = () => {
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [, setAdminUser] = useState<any>(null);

  if (!adminToken) {
    return <AdminLogin onLogin={(token, user) => { setAdminToken(token); setAdminUser(user); localStorage.setItem('admin_token', token); }} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setAdminToken(null);
    setAdminUser(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">管理画面</h1>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          ログアウト
        </Button>
      </div>
      <Tabs defaultValue="users">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="users">ユーザー管理</TabsTrigger>
          <TabsTrigger value="founders">創業メンバー管理</TabsTrigger>
          <TabsTrigger value="ambassadors">有料会員紹介管理</TabsTrigger>
          <TabsTrigger value="referrals">紹介登録一覧</TabsTrigger>
          <TabsTrigger value="salon">サロン管理</TabsTrigger>
          <TabsTrigger value="blog">ブログ作成</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UserManagementTab token={adminToken} />
        </TabsContent>
        <TabsContent value="founders">
          <FounderManagementTab token={adminToken} />
        </TabsContent>
        <TabsContent value="ambassadors">
          <AmbassadorManagementTab token={adminToken} />
        </TabsContent>
        <TabsContent value="referrals">
          <ReferralListTab token={adminToken} />
        </TabsContent>
        <TabsContent value="salon">
          <SalonManagementTab token={adminToken} />
        </TabsContent>
        <TabsContent value="blog">
          <BlogGeneratorTab token={adminToken} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const AdminLogin: React.FC<{ onLogin: (token: string, user: any) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'ログインに失敗しました');
      }
      const data = await res.json();
      onLogin(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-16">
      <Card>
        <CardContent className="p-8">
          <h2 className="text-xl font-bold mb-6 text-center">管理者ログイン</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="email" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} required />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

interface UserItem {
  id: number;
  email: string;
  display_name: string;
  created_at: string | null;
  payment_status: string | null;
  subscription_status: string | null;
  is_active: boolean;
  community_category: string | null;
  position: string | null;
  profile_complete: boolean;
  account_status: string | null;
  membership_type: string | null;
  card_required: boolean | null;
  card_registered: boolean | null;
  kyc_status: string | null;
  referred_by_founder_code: string | null;
}

const UserManagementTab: React.FC<{ token: string }> = ({ token }) => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const pageSize = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (query) params.set('query', query);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${BACKEND_URL}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, page, query, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${BACKEND_URL}/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="名前またはメールで検索..."
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">すべてのステータス</option>
          <option value="active">Active</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>表示名</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>会員種別</TableHead>
              <TableHead>アカウント状態</TableHead>
              <TableHead>本人確認</TableHead>
              <TableHead>カード</TableHead>
              <TableHead>プロフィール</TableHead>
              <TableHead>登録日</TableHead>
              <TableHead>紹介コード</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-500">読み込み中...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-gray-500">ユーザーが見つかりません</TableCell></TableRow>
            ) : (
              users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.display_name}</TableCell>
                  <TableCell className="text-sm text-gray-600">{u.email}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      u.membership_type === 'founder_free' ? 'bg-purple-100 text-purple-700' :
                      u.membership_type === 'admin' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {u.membership_type === 'founder_free' ? '招待' :
                       u.membership_type === 'admin' ? '管理者' :
                       u.membership_type === 'premium' ? '通常' : u.membership_type || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      u.account_status === 'active' ? 'bg-green-100 text-green-700' :
                      u.account_status === 'suspended' ? 'bg-red-100 text-red-700' :
                      u.account_status === 'identity_review' ? 'bg-orange-100 text-orange-700' :
                      u.account_status === 'identity_rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {u.account_status || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      u.kyc_status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                      u.kyc_status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {u.kyc_status || 'UNVERIFIED'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {u.card_required === false ? '不要' :
                     u.card_registered ? '登録済' : '未登録'}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${u.profile_complete ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {u.profile_complete ? '完成' : '未完成'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('ja-JP') : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {u.referred_by_founder_code || '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(u)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      　</div>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{total}件中 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}件</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザー削除</DialogTitle>
            <DialogDescription>
              {deleteTarget?.display_name}（{deleteTarget?.email}）を削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete}>削除する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

type BlogStep = 'input' | 'generating' | 'preview' | 'editing' | 'publishing' | 'done';

interface BlogItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  image_url: string | null;
  published_at: string | null;
  created_at: string | null;
}

const BlogGeneratorTab: React.FC<{ token: string }> = ({ token }) => {
  const [step, setStep] = useState<BlogStep>('input');
  const [titleCandidates, setTitleCandidates] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [generated, setGenerated] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editExcerpt, setEditExcerpt] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [error, setError] = useState('');
  const [blogList, setBlogList] = useState<BlogItem[]>([]);
  const [blogListLoading, setBlogListLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogItem | null>(null);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchBlogList = useCallback(async () => {
    setBlogListLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/blog`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch blogs');
      const data = await res.json();
      setBlogList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setBlogListLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchBlogList(); }, [fetchBlogList]);

  const handleDeleteBlog = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/blog/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteTarget(null);
      fetchBlogList();
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = async (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const url = data.url.startsWith('http') ? data.url : `${BACKEND_URL}${data.url}`;
      setImageUrl(url);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGenerate = async () => {
    setStep('generating');
    setError('');
    try {
      const titles = titleCandidates.split('\n').filter(t => t.trim());
      if (titles.length === 0) throw new Error('タイトル候補を入力してください');
      const res = await fetch(`${BACKEND_URL}/api/admin/blog/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title_candidates: titles, image_url: imageUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Generation failed');
      }
      const data = await res.json();
      setGenerated(data);
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
      setStep('input');
    }
  };

  const startEditing = () => {
    if (!generated) return;
    setEditTitle(generated.final_title || '');
    setEditBody(generated.body || '');
    setEditExcerpt(generated.excerpt || '');
    setEditKeywords((generated.keywords || []).join(', '));
    setStep('editing');
  };

  const saveEdits = () => {
    setGenerated({
      ...generated,
      final_title: editTitle,
      body: editBody,
      excerpt: editExcerpt,
      keywords: editKeywords.split(',').map((k: string) => k.trim()).filter(Boolean),
    });
    setStep('preview');
  };

  const handlePublish = async () => {
    setStep('publishing');
    setError('');
    try {
      const saveRes = await fetch(`${BACKEND_URL}/api/admin/blog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: generated.final_title,
          slug: generated.slug,
          body: generated.body,
          excerpt: generated.excerpt,
          image_url: imageUrl,
          seo_keywords: generated.keywords,
        }),
      });
      if (!saveRes.ok) throw new Error('Save failed');
      const saved = await saveRes.json();

      const pubRes = await fetch(`${BACKEND_URL}/api/admin/blog/${saved.id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!pubRes.ok) throw new Error('Publish failed');
      setStep('done');
    } catch (err: any) {
      setError(err.message);
      setStep('preview');
    }
  };

  const resetForm = () => {
    setStep('input');
    setTitleCandidates('');
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
    setGenerated(null);
    setEditTitle('');
    setEditBody('');
    setEditExcerpt('');
    setEditKeywords('');
    setError('');
    setEditingBlogId(null);
  };

  const handleEditBlog = async (blogId: string) => {
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/blog/${blogId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch blog');
      const data = await res.json();
      setEditingBlogId(blogId);
      setEditTitle(data.title);
      setEditBody(data.body);
      setEditExcerpt(data.excerpt || '');
      setEditKeywords((data.seo_keywords || []).join(', '));
      setImageUrl(data.image_url || '');
      setImagePreview(data.image_url || '');
      setStep('editing');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateBlog = async () => {
    if (!editingBlogId) return;
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/blog/${editingBlogId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: editTitle,
          body: editBody,
          excerpt: editExcerpt,
          image_url: imageUrl,
          seo_keywords: editKeywords.split(',').map((k: string) => k.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      resetForm();
      fetchBlogList();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (step === 'done') {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <h3 className="text-xl font-bold">ブログを公開しました</h3>
          <p className="text-gray-600">「{generated?.final_title}」が /blog に公開されました。</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(`/blog/${generated?.slug}`)}>
              <Eye className="h-4 w-4 mr-2" />記事を見る
            </Button>
            <Button onClick={resetForm}>新しい記事を作成</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'editing') {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">{editingBlogId ? '既存記事を編集' : '記事を編集'}</h3>
            <div>
              <label className="block text-sm font-medium mb-1">タイトル</label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">SEOキーワード（カンマ区切り）</label>
              <Input value={editKeywords} onChange={e => setEditKeywords(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">抜粋</label>
              <Textarea rows={2} value={editExcerpt} onChange={e => setEditExcerpt(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">画像URL</label>
              <div className="space-y-2">
                <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="画像URLを入力" />
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm">
                    <Upload className="h-4 w-4" />
                    新しい画像をアップロード
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    />
                  </label>
                  {imageFile && <span className="text-sm text-gray-600">{imageFile.name}</span>}
                </div>
                {imagePreview && (
                  <img src={imagePreview} alt="preview" className="mt-3 max-h-48 rounded-lg object-cover" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">本文</label>
              <Textarea rows={16} value={editBody} onChange={e => setEditBody(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">{editBody.length}文字</p>
            </div>
          </CardContent>
        </Card>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => editingBlogId ? resetForm() : setStep('preview')}>キャンセル</Button>
          <Button onClick={editingBlogId ? handleUpdateBlog : saveEdits}>
            {editingBlogId ? '更新する' : '編集を保存してプレビューへ'}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'preview' && generated) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-1">プレビュー</h3>
            <div className="space-y-4">
              {imagePreview && (
                <img src={imagePreview} alt="preview" className="w-full max-h-64 object-cover rounded-lg" />
              )}
              <h2 className="text-2xl font-bold">{generated.final_title}</h2>
              <div className="flex flex-wrap gap-2">
                {generated.keywords?.map((kw: string, i: number) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{kw}</span>
                ))}
              </div>
              <p className="text-gray-500 text-sm italic">{generated.excerpt}</p>
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-700">{generated.body}</div>
              </div>
              <p className="text-xs text-gray-400">本文: {generated.body?.length}文字 | slug: {generated.slug}</p>
            </div>
          </CardContent>
        </Card>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('input')}>戻る</Button>
          <Button variant="outline" onClick={startEditing}>
            <Pencil className="h-4 w-4 mr-2" />
            編集する
          </Button>
          <Button onClick={handlePublish}>
            <Send className="h-4 w-4 mr-2" />
            公開する
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">タイトル候補（1行1候補）</label>
            <Textarea
              rows={4}
              placeholder={"例:\nLGBTQ+コミュニティの新しいつながり方\n多様性を尊重する社会の実現に向けて"}
              value={titleCandidates}
              onChange={e => setTitleCandidates(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">画像アップロード</label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm">
                <Upload className="h-4 w-4" />
                画像を選択
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
              </label>
              {imageFile && <span className="text-sm text-gray-600">{imageFile.name}</span>}
            </div>
            {imagePreview && (
              <img src={imagePreview} alt="preview" className="mt-3 max-h-48 rounded-lg object-cover" />
            )}
          </div>
        </CardContent>
      </Card>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button onClick={handleGenerate} disabled={step === 'generating' || !titleCandidates.trim()}>
        <Sparkles className="h-4 w-4 mr-2" />
        {step === 'generating' ? 'SEO記事生成中...' : 'SEO記事生成'}
      </Button>

      {blogList.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">公開済み・下書き記事</h3>
            {blogListLoading ? (
              <p className="text-gray-500 text-sm">読み込み中...</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>タイトル</TableHead>
                    <TableHead className="w-24">ステータス</TableHead>
                    <TableHead className="w-32">公開日</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blogList.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        {b.status === 'published' ? (
                          <a href={`/blog/${b.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{b.title}</a>
                        ) : b.title}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          b.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {b.status === 'published' ? '公開中' : '下書き'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {b.published_at ? new Date(b.published_at).toLocaleDateString('ja-JP') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditBlog(b.id)}>
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(b)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>記事を削除</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.title}」を削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDeleteBlog}>削除する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ===== Founder Management Tab =====
interface FounderItem {
  id: number;
  founder_code: string;
  display_name: string;
  is_active: boolean;
  max_invites: number | null;
  referral_count: number;
  referral_url: string;
  created_at: string;
  updated_at: string;
}

const FounderManagementTab: React.FC<{ token: string }> = ({ token }) => {
  const [founders, setFounders] = useState<FounderItem[]>([]);
  const [totalFounderFree, setTotalFounderFree] = useState(0);
  const [founderFreeLimit, setFounderFreeLimit] = useState(200);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrDialog, setQrDialog] = useState<{ open: boolean; code: string; dataUrl: string }>({ open: false, code: '', dataUrl: '' });

  const fetchFounders = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/founders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFounders(data.items);
        setTotalFounderFree(data.total_founder_free_members);
        setFounderFreeLimit(data.founder_free_limit);
      }
    } catch (e) {
      console.error('Failed to fetch founders', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchFounders(); }, [fetchFounders]);

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      await fetch(`${BACKEND_URL}/api/admin/founders/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      fetchFounders();
    } catch (e) {
      console.error('Failed to toggle founder', e);
    }
  };

  const handleSaveName = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/api/admin/founders/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: editName }),
      });
      setEditingId(null);
      fetchFounders();
    } catch (e) {
      console.error('Failed to update founder name', e);
    }
  };

  const handleCopyUrl = (code: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleShowQr = async (id: number, code: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/founders/${id}/qr`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQrDialog({ open: true, code, dataUrl: data.qr_data_url });
      }
    } catch (e) {
      console.error('Failed to fetch QR', e);
    }
  };

  const progressPercent = Math.min((totalFounderFree / founderFreeLimit) * 100, 100);

  if (loading) return <div className="text-center py-8">読み込み中...</div>;

  return (
    <div className="space-y-6">
      {/* Quota Progress */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-3">創業メンバー枠</h3>
        <div className="flex items-center gap-4 mb-2">
          <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressPercent >= 90 ? 'bg-red-500' : progressPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm font-medium whitespace-nowrap">
            {totalFounderFree} / {founderFreeLimit} 名
          </span>
        </div>
        <p className="text-sm text-gray-500">
          残り {Math.max(founderFreeLimit - totalFounderFree, 0)} 名の無料枠があります
        </p>
      </div>

      {/* Founder List */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>コード</TableHead>
              <TableHead>表示名</TableHead>
              <TableHead className="text-center">紹介数</TableHead>
              <TableHead>紹介URL</TableHead>
              <TableHead className="text-center">QR</TableHead>
              <TableHead className="text-center">状態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {founders.map((f) => (
              <TableRow key={f.id} className={!f.is_active ? 'opacity-50' : ''}>
                <TableCell className="font-mono font-bold">{f.founder_code}</TableCell>
                <TableCell>
                  {editingId === f.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 w-40"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName(f.id)}
                      />
                      <Button size="sm" variant="ghost" onClick={() => handleSaveName(f.id)}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span>{f.display_name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingId(f.id); setEditName(f.display_name); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">{f.referral_count}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">{f.referral_url}</span>
                    <Button size="sm" variant="ghost" onClick={() => handleCopyUrl(f.founder_code, f.referral_url)}>
                      {copiedCode === f.founder_code ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Button size="sm" variant="ghost" onClick={() => handleShowQr(f.id, f.founder_code)}>
                    <QrCode className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    size="sm"
                    variant={f.is_active ? 'default' : 'outline'}
                    onClick={() => handleToggleActive(f.id, f.is_active)}
                    className="text-xs"
                  >
                    {f.is_active ? '有効' : '無効'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialog.open} onOpenChange={(open) => setQrDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QRコード: {qrDialog.code}</DialogTitle>
            <DialogDescription>このQRコードをスキャンすると紹介登録ページに遷移します</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {qrDialog.dataUrl && <img src={qrDialog.dataUrl} alt={`QR Code for ${qrDialog.code}`} className="w-64 h-64" />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialog({ open: false, code: '', dataUrl: '' })}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ===== Ambassador Management Tab =====
interface AmbassadorItem {
  id: number;
  ambassador_code: string;
  display_name: string;
  is_active: boolean;
  max_invites: number | null;
  referral_count: number;
  referral_url: string;
  created_at: string;
  updated_at: string;
}

const AmbassadorManagementTab: React.FC<{ token: string }> = ({ token }) => {
  const [ambassadors, setAmbassadors] = useState<AmbassadorItem[]>([]);
  const [totalPaidReferrals, setTotalPaidReferrals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrDialog, setQrDialog] = useState<{ open: boolean; code: string; dataUrl: string }>({ open: false, code: '', dataUrl: '' });

  const fetchAmbassadors = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ambassadors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAmbassadors(data.items);
        setTotalPaidReferrals(data.total_paid_referrals);
      }
    } catch (e) {
      console.error('Failed to fetch ambassadors', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAmbassadors(); }, [fetchAmbassadors]);

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      await fetch(`${BACKEND_URL}/api/admin/ambassadors/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      fetchAmbassadors();
    } catch (e) {
      console.error('Failed to toggle ambassador', e);
    }
  };

  const handleSaveName = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/api/admin/ambassadors/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: editName }),
      });
      setEditingId(null);
      fetchAmbassadors();
    } catch (e) {
      console.error('Failed to update ambassador name', e);
    }
  };

  const handleCopyUrl = (code: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleShowQr = async (id: number, code: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ambassadors/${id}/qr`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQrDialog({ open: true, code, dataUrl: data.qr_data_url });
      }
    } catch (e) {
      console.error('Failed to fetch QR', e);
    }
  };

  if (loading) return <div className="text-center py-8">読み込み中...</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-3">有料会員紹介コード</h3>
        <p className="text-sm text-gray-500">
          有料会員紹介経由の登録数: <span className="font-semibold text-gray-800">{totalPaidReferrals}</span> 名
        </p>
        <p className="text-xs text-gray-400 mt-1">
          紹介コード経由の新規登録は、本人確認＋クレジットカード登録が必要です
        </p>
      </div>

      {/* Ambassador List */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>コード</TableHead>
              <TableHead>表示名</TableHead>
              <TableHead className="text-center">紹介数</TableHead>
              <TableHead>紹介URL</TableHead>
              <TableHead className="text-center">QR</TableHead>
              <TableHead className="text-center">状態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ambassadors.map((a) => (
              <TableRow key={a.id} className={!a.is_active ? 'opacity-50' : ''}>
                <TableCell className="font-mono font-bold">{a.ambassador_code}</TableCell>
                <TableCell>
                  {editingId === a.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 w-40"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName(a.id)}
                      />
                      <Button size="sm" variant="ghost" onClick={() => handleSaveName(a.id)}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span>{a.display_name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingId(a.id); setEditName(a.display_name); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">{a.referral_count}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">{a.referral_url}</span>
                    <Button size="sm" variant="ghost" onClick={() => handleCopyUrl(a.ambassador_code, a.referral_url)}>
                      {copiedCode === a.ambassador_code ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Button size="sm" variant="ghost" onClick={() => handleShowQr(a.id, a.ambassador_code)}>
                    <QrCode className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    size="sm"
                    variant={a.is_active ? 'default' : 'outline'}
                    onClick={() => handleToggleActive(a.id, a.is_active)}
                    className="text-xs"
                  >
                    {a.is_active ? '有効' : '無効'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialog.open} onOpenChange={(open) => setQrDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QRコード: {qrDialog.code}</DialogTitle>
            <DialogDescription>このQRコードをスキャンすると有料会員登録ページに遷移します</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {qrDialog.dataUrl && <img src={qrDialog.dataUrl} alt={`QR Code for ${qrDialog.code}`} className="w-64 h-64" />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialog({ open: false, code: '', dataUrl: '' })}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ===== Referral List Tab =====
interface ReferralItem {
  id: number;
  user_id: number;
  user_display_name: string;
  user_email: string;
  founder_code: string | null;
  founder_display_name: string | null;
  ref_code: string;
  status: string;
  membership_type: string;
  registered_at: string;
}

const ReferralListTab: React.FC<{ token: string }> = ({ token }) => {
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [founderCodeFilter, setFounderCodeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (founderCodeFilter) params.set('founder_code', founderCodeFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (searchQuery) params.set('query', searchQuery);

      const res = await fetch(`${BACKEND_URL}/api/admin/referrals?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReferrals(data.items);
        setTotal(data.total);
      }
    } catch (e) {
      console.error('Failed to fetch referrals', e);
    } finally {
      setLoading(false);
    }
  }, [token, page, founderCodeFilter, dateFrom, dateTo, searchQuery]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  const handleCsvExport = async () => {
    try {
      const params = new URLSearchParams();
      if (founderCodeFilter) params.set('founder_code', founderCodeFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (searchQuery) params.set('query', searchQuery);

      const res = await fetch(`${BACKEND_URL}/api/admin/referrals/csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `referrals_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Failed to export CSV', e);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'registered': return '登録済み';
      case 'active': return 'アクティブ';
      case 'inactive': return '非アクティブ';
      default: return s;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">紹介コード</label>
            <Input
              placeholder="例: Ca01"
              value={founderCodeFilter}
              onChange={(e) => { setFounderCodeFilter(e.target.value); setPage(1); }}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">開始日</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">終了日</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">検索（名前/メール）</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={handleCsvExport} className="h-9">
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Results summary */}
      <div className="text-sm text-gray-500">
        全 {total} 件{totalPages > 1 && ` （ページ ${page} / ${totalPages}）`}
      </div>

      {/* Referral Table */}
      <div className="bg-white rounded-lg border">
        {loading ? (
          <div className="text-center py-8">読み込み中...</div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">紹介登録データがありません</div>
        ) : (
          <div className="overflow-x-auto">
      <Table>
            <TableHeader>
              <TableRow>
                <TableHead>登録日</TableHead>
                <TableHead>ユーザー名</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>紹介コード</TableHead>
                <TableHead>紹介元</TableHead>
                <TableHead>会員種別</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {r.registered_at ? new Date(r.registered_at).toLocaleDateString('ja-JP') : '-'}
                  </TableCell>
                  <TableCell>{r.user_display_name}</TableCell>
                  <TableCell className="text-sm text-gray-500">{r.user_email}</TableCell>
                  <TableCell className="font-mono">{r.founder_code || r.ref_code}</TableCell>
                  <TableCell>{r.founder_display_name || '-'}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      r.membership_type === 'founder_free'
                        ? 'bg-purple-100 text-purple-700'
                        : r.membership_type === 'premium'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {r.membership_type === 'founder_free' ? '招待無料' : r.membership_type === 'premium' ? '有料' : r.membership_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      r.status === 'active' ? 'bg-green-100 text-green-700' : r.status === 'registered' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {statusLabel(r.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            前へ
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            次へ
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

// ── Salon Management Tab ──────────────────────────────────

interface SalonCategoryAdmin {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  group_name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  warning_text: string | null;
  room_count: number;
}

interface SalonRoomAdmin {
  id: number;
  theme: string;
  room_type: string;
  target_identities: string[];
  is_active: boolean;
  creator_display_name: string | null;
  created_at: string | null;
}

interface SalonReportAdmin {
  id: number;
  room_id: number | null;
  post_id: number | null;
  comment_id: number | null;
  reporter_name: string | null;
  reason: string;
  status: string;
  created_at: string | null;
}

const SalonManagementTab: React.FC<{ token: string }> = ({ token }) => {
  const [subTab, setSubTab] = useState<'categories' | 'rooms' | 'reports'>('categories');
  const [categories, setCategories] = useState<SalonCategoryAdmin[]>([]);
  const [rooms, setRooms] = useState<SalonRoomAdmin[]>([]);
  const [reports, setReports] = useState<SalonReportAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatData, setEditCatData] = useState<Partial<SalonCategoryAdmin>>({});

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/salon/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCategories(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/admin/salon-rooms?size=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/salon/admin/reports?status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCategories(), fetchRooms(), fetchReports()]).finally(() => setLoading(false));
  }, [fetchCategories, fetchRooms, fetchReports]);

  const saveCategoryEdit = async (catId: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/salon/admin/categories/${catId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editCatData),
      });
      if (res.ok) {
        setEditingCatId(null);
        setEditCatData({});
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleRoomActive = async (roomId: number, isActive: boolean) => {
    try {
      await fetch(`${BACKEND_URL}/api/salon/admin/rooms/${roomId}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive, status: isActive ? 'suspended' : 'active' }),
      });
      fetchRooms();
    } catch (err) {
      console.error(err);
    }
  };

  const resolveReport = async (reportId: number, status: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/salon/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchReports();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center py-8">読み込み中...</div>;

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(['categories', 'rooms', 'reports'] as const).map(tab => (
          <Button
            key={tab}
            variant={subTab === tab ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSubTab(tab)}
          >
            {tab === 'categories' ? 'カテゴリー管理' : tab === 'rooms' ? 'サロン室管理' : `通報 (${reports.length})`}
          </Button>
        ))}
      </div>

      {/* Categories */}
      {subTab === 'categories' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">サロンカテゴリー管理</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>アイコン</TableHead>
                  <TableHead>表示名</TableHead>
                  <TableHead>グループ</TableHead>
                  <TableHead>サロン数</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(cat => (
                  <TableRow key={cat.id}>
                    <TableCell>{cat.id}</TableCell>
                    <TableCell>{cat.icon}</TableCell>
                    <TableCell>
                      {editingCatId === cat.id ? (
                        <Input
                          value={editCatData.display_name ?? cat.display_name}
                          onChange={e => setEditCatData(prev => ({ ...prev, display_name: e.target.value }))}
                          className="w-40"
                        />
                      ) : cat.display_name}
                    </TableCell>
                    <TableCell>{cat.group_name}</TableCell>
                    <TableCell>{cat.room_count}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cat.is_active ? '有効' : '無効'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {editingCatId === cat.id ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => saveCategoryEdit(cat.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingCatId(null); setEditCatData({}); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => { setEditingCatId(cat.id); setEditCatData({}); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditCatData({ is_active: !cat.is_active });
                              setEditingCatId(cat.id);
                              setTimeout(() => saveCategoryEdit(cat.id), 100);
                            }}
                          >
                            {cat.is_active ? <Eye className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Rooms */}
      {subTab === 'rooms' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">サロン室管理</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>テーマ</TableHead>
                  <TableHead>作成者</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map(room => (
                  <TableRow key={room.id}>
                    <TableCell>{room.id}</TableCell>
                    <TableCell className="max-w-[250px] truncate">{room.theme}</TableCell>
                    <TableCell>{room.creator_display_name || '-'}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${room.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {room.is_active ? '公開中' : '停止'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleRoomActive(room.id, room.is_active)}
                        className={room.is_active ? 'text-red-600' : 'text-green-600'}
                      >
                        {room.is_active ? '停止' : '再開'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rooms.length === 0 && <div className="text-center py-8 text-gray-500">サロン室がありません</div>}
        </div>
      )}

      {/* Reports */}
      {subTab === 'reports' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">通報管理</h2>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">未対応の通報はありません</div>
          ) : (
            <div className="space-y-3">
              {reports.map(report => (
                <Card key={report.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">通報 #{report.id}</p>
                        <p className="text-xs text-gray-500">
                          {report.room_id && `サロン室 #${report.room_id}`}
                          {report.post_id && ` / 投稿 #${report.post_id}`}
                          {report.comment_id && ` / コメント #${report.comment_id}`}
                        </p>
                        <p className="text-sm mt-1">{report.reason}</p>
                        <p className="text-xs text-gray-400 mt-1">報告者: {report.reporter_name || '-'}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => resolveReport(report.id, 'resolved')}>
                          <Check className="h-3 w-3 mr-1" /> 対応済
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => resolveReport(report.id, 'dismissed')}>
                          却下
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
