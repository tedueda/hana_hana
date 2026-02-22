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
import { Search, Trash2, Upload, Sparkles, Eye, Send, ChevronLeft, ChevronRight, LogOut, Pencil } from 'lucide-react';
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
        <TabsList className="mb-6">
          <TabsTrigger value="users">ユーザー管理</TabsTrigger>
          <TabsTrigger value="blog">ブログ作成</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UserManagementTab token={adminToken} />
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>表示名</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>登録日</TableHead>
              <TableHead>決済状態</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">読み込み中...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">ユーザーが見つかりません</TableCell></TableRow>
            ) : (
              users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.display_name}</TableCell>
                  <TableCell className="text-sm text-gray-600">{u.email}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('ja-JP') : '-'}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      u.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                      u.subscription_status === 'past_due' ? 'bg-yellow-100 text-yellow-700' :
                      u.subscription_status === 'canceled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {u.subscription_status || u.payment_status || '-'}
                    </span>
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

  if (step === 'editing' && generated) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">記事を編集</h3>
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
              <label className="block text-sm font-medium mb-1">本文</label>
              <Textarea rows={16} value={editBody} onChange={e => setEditBody(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">{editBody.length}文字</p>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('preview')}>キャンセル</Button>
          <Button onClick={saveEdits}>編集を保存してプレビューへ</Button>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>タイトル</TableHead>
                    <TableHead className="w-24">ステータス</TableHead>
                    <TableHead className="w-32">公開日</TableHead>
                    <TableHead className="w-16"></TableHead>
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
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(b)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

export default AdminPage;
