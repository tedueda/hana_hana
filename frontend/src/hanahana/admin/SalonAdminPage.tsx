import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  adminFetchSalonComments,
  adminFetchSalonModerationLog,
  adminFetchSalonPosts,
  adminFetchSalonStats,
  adminModerateSalon,
  fetchSalonCategories,
  type AdminSalonComment,
  type AdminSalonPost,
  type SalonCategory,
  type SalonModerationAction,
  type SalonModerationLog,
  type SalonStats,
} from '../api/salon';
import { useAdminRole } from './context';
import { Empty, PageHeader } from './common';
import { errorMessage, fmtDate } from './labels';

type Filter = 'reported' | 'flagged' | 'hidden' | 'all';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'reported', label: '通報あり' },
  { key: 'flagged', label: '自動検知' },
  { key: 'hidden', label: '非表示中' },
  { key: 'all', label: 'すべて' },
];

const ACTION_LABELS: Record<SalonModerationAction, string> = {
  hide: '非表示',
  unhide: '復帰',
  delete: '削除',
  pin: 'ピン留め(7日)',
  unpin: 'ピン解除',
  clear_flag: '検知解除',
};

const STAT_LABELS: Record<string, string> = {
  posts_total: '投稿数(累計)',
  posts_7d: '投稿数(7日)',
  comments_7d: 'コメント数(7日)',
  posters_7d_jp: '投稿者数 日本(7日)',
  posters_7d_kr: '投稿者数 韓国(7日)',
  reply_rate_48h: '48h以内返信率(%)',
  reports_open: '未対応通報',
  flagged: '未確認検知',
  hidden: '非表示中',
};

const FlagBadges: React.FC<{ flagged: boolean; flag_reason: string | null; is_hidden: boolean; deleted_at: string | null; open_report_count: number }> = (p) => (
  <div className="flex flex-wrap gap-1 text-[11px]">
    {p.deleted_at && <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">削除済</span>}
    {p.is_hidden && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">非表示</span>}
    {p.flagged && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">検知: {p.flag_reason ?? '-'}</span>}
    {p.open_report_count > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">未対応通報 {p.open_report_count}</span>}
  </div>
);

const useModerate = (onDone: () => void) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (type: 'post' | 'comment', id: string, action: SalonModerationAction) => {
    let reason: string | undefined;
    if (action === 'hide' || action === 'delete') {
      const r = window.prompt(`${ACTION_LABELS[action]}の理由 (必須)`);
      if (!r || !r.trim()) return;
      reason = r.trim();
    } else if (!window.confirm(`${ACTION_LABELS[action]}しますか？`)) return;
    setBusy(true);
    try {
      await adminModerateSalon(type, id, action, reason);
      toast({ title: `${ACTION_LABELS[action]}しました` });
      onDone();
    } catch (e) {
      toast({ title: '失敗しました', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
};

const ActionButtons: React.FC<{
  type: 'post' | 'comment';
  id: string;
  row: { is_hidden: boolean; flagged: boolean; deleted_at: string | null; pinned_until?: string | null };
  canModerate: boolean;
  onDone: () => void;
}> = ({ type, id, row, canModerate, onDone }) => {
  const { run, busy } = useModerate(onDone);
  if (!canModerate || row.deleted_at) return null;
  const pinned = !!row.pinned_until && new Date(row.pinned_until) > new Date();
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {row.is_hidden ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(type, id, 'unhide')}>{ACTION_LABELS.unhide}</Button>
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(type, id, 'hide')}>{ACTION_LABELS.hide}</Button>
      )}
      {row.flagged && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(type, id, 'clear_flag')}>{ACTION_LABELS.clear_flag}</Button>}
      {type === 'post' && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(type, id, pinned ? 'unpin' : 'pin')}>{pinned ? ACTION_LABELS.unpin : ACTION_LABELS.pin}</Button>
      )}
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => run(type, id, 'delete')}>{ACTION_LABELS.delete}</Button>
    </div>
  );
};

const PostRow: React.FC<{ p: AdminSalonPost; cats: Map<string, string>; canModerate: boolean; onDone: () => void }> = ({ p, cats, canModerate, onDone }) => (
  <Card>
    <CardContent className="p-4 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">{cats.get(p.category_id) ?? p.category_id}</span>
        <Link to={`/app/salon/${p.id}`} className="font-medium text-blue-600 hover:underline">{p.title}</Link>
        <span className="text-xs text-gray-500 ml-auto">{fmtDate(p.created_at)}</span>
      </div>
      <p className="text-gray-700 whitespace-pre-wrap break-words line-clamp-3">{p.body}</p>
      <div className="text-xs text-gray-500">
        投稿者: <Link to={`/app/admin/users/${p.author_id}`} className="text-blue-600 hover:underline">{p.author_nickname ?? p.author_id}</Link>
        {' '}/ コメント {p.comment_count} / リアクション {p.reaction_count} / 通報 {p.report_count}
        {p.hidden_reason && <> / 非表示理由: {p.hidden_reason}</>}
      </div>
      <FlagBadges {...p} />
      <ActionButtons type="post" id={p.id} row={p} canModerate={canModerate} onDone={onDone} />
    </CardContent>
  </Card>
);

const CommentRow: React.FC<{ c: AdminSalonComment; canModerate: boolean; onDone: () => void }> = ({ c, canModerate, onDone }) => (
  <Card>
    <CardContent className="p-4 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>投稿: <Link to={`/app/salon/${c.post_id}`} className="text-blue-600 hover:underline">{c.post_title}</Link></span>
        <span className="ml-auto">{fmtDate(c.created_at)}</span>
      </div>
      <p className="text-gray-700 whitespace-pre-wrap break-words">{c.body}</p>
      <div className="text-xs text-gray-500">
        投稿者: <Link to={`/app/admin/users/${c.author_id}`} className="text-blue-600 hover:underline">{c.author_nickname ?? c.author_id}</Link>
        {' '}/ 通報 {c.report_count}
        {c.hidden_reason && <> / 非表示理由: {c.hidden_reason}</>}
      </div>
      <FlagBadges {...c} />
      <ActionButtons type="comment" id={c.id} row={c} canModerate={canModerate} onDone={onDone} />
    </CardContent>
  </Card>
);

const SalonAdminPage: React.FC = () => {
  const role = useAdminRole();
  const canModerate = role === 'super_admin' || role === 'moderator';
  const { toast } = useToast();
  const [tab, setTab] = useState<'posts' | 'comments' | 'log'>('posts');
  const [filter, setFilter] = useState<Filter>('reported');
  const [category, setCategory] = useState('');
  const [postId, setPostId] = useState('');
  const [cats, setCats] = useState<SalonCategory[]>([]);
  const [posts, setPosts] = useState<AdminSalonPost[]>([]);
  const [comments, setComments] = useState<AdminSalonComment[]>([]);
  const [log, setLog] = useState<SalonModerationLog[]>([]);
  const [stats, setStats] = useState<SalonStats>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSalonCategories().then(setCats).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s] = await Promise.all([adminFetchSalonStats()]);
      setStats(s);
      if (tab === 'posts') setPosts(await adminFetchSalonPosts(filter, category || null));
      else if (tab === 'comments') setComments(await adminFetchSalonComments(filter, postId.trim() || undefined));
      else setLog(await adminFetchSalonModerationLog());
    } catch (e) {
      toast({ title: '読み込みに失敗しました', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tab, filter, category, postId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const catMap = new Map(cats.map((c) => [c.id, c.name_ja]));

  return (
    <div className="space-y-4">
      <PageHeader title="交流サロン管理">
        <Link to="/app/salon" className="text-sm text-blue-600 hover:underline">サロンを開く</Link>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Object.entries(STAT_LABELS).map(([k, label]) => (
          <Card key={k}>
            <CardContent className="p-3">
              <p className="text-[11px] text-gray-500">{label}</p>
              <p className="text-lg font-semibold">{stats[k] ?? '-'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 border-b">
        {(['posts', 'comments', 'log'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm border-b-2 ${tab === k ? 'border-rose-500 text-rose-600 font-medium' : 'border-transparent text-gray-600'}`}
          >
            {k === 'posts' ? '投稿' : k === 'comments' ? 'コメント' : '操作履歴'}
          </button>
        ))}
      </div>

      {tab !== 'log' && (
        <div className="flex flex-wrap gap-2 items-center">
          {FILTERS.map((f) => (
            <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
          {tab === 'posts' ? (
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border px-2 text-sm bg-white">
              <option value="">全テーマ</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name_ja}</option>
              ))}
            </select>
          ) : (
            <Input value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="投稿ID で絞り込み" className="h-9 w-64" />
          )}
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>更新</Button>
        </div>
      )}

      {!canModerate && <p className="text-xs text-gray-500">閲覧のみ (非表示・削除などの操作は moderator 以上)</p>}

      {tab === 'posts' && (posts.length === 0 ? <Empty /> : <div className="space-y-2">{posts.map((p) => <PostRow key={p.id} p={p} cats={catMap} canModerate={canModerate} onDone={load} />)}</div>)}
      {tab === 'comments' && (comments.length === 0 ? <Empty /> : <div className="space-y-2">{comments.map((c) => <CommentRow key={c.id} c={c} canModerate={canModerate} onDone={load} />)}</div>)}
      {tab === 'log' &&
        (log.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr><th className="p-2">日時</th><th className="p-2">操作</th><th className="p-2">対象</th><th className="p-2">理由</th><th className="p-2">管理者</th></tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                    <td className="p-2">{ACTION_LABELS[l.action as SalonModerationAction] ?? l.action}</td>
                    <td className="p-2">
                      {l.target_type === 'post' ? <Link to={`/app/salon/${l.target_id}`} className="text-blue-600 hover:underline">投稿</Link> : 'コメント'}
                      <span className="text-xs text-gray-400 ml-1">{l.target_id.slice(0, 8)}</span>
                    </td>
                    <td className="p-2">{l.reason ?? '-'}</td>
                    <td className="p-2"><Link to={`/app/admin/users/${l.admin_user_id}`} className="text-blue-600 hover:underline">{l.admin_user_id.slice(0, 8)}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
};

export default SalonAdminPage;
