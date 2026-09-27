import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { fetchAuditLogs, jsonText, listAdmins, removeAdmin, upsertAdmin, type AdminAdminRow, type AdminRole } from '../api/admin';
import { useAdminRole } from './context';
import { Empty, PageHeader } from './common';
import { errorMessage, fmtDate } from './labels';

type AuditRow = Awaited<ReturnType<typeof fetchAuditLogs>>[number];

const targetLink = (type: string | null, id: string | null): React.ReactNode => {
  if (!id) return '-';
  if (type === 'user') return <Link to={`/app/admin/users/${id}`} className="text-blue-600 hover:underline font-mono text-xs">{id.slice(0, 8)}…</Link>;
  return <span className="font-mono text-xs">{type ?? ''} {id.slice(0, 8)}…</span>;
};

export const AuditPage: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [admins, setAdmins] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchAuditLogs(200).then(setRows).catch((e) => {
      setRows([]);
      toast({ title: '取得に失敗しました', description: errorMessage(e), variant: 'destructive' });
    });
    listAdmins().then((a) => setAdmins(new Map(a.map((x) => [x.user_id, x.nickname ?? x.email ?? x.user_id])))).catch(() => undefined);
  }, [toast]);

  return (
    <div>
      <PageHeader title="操作ログ" />
      <div className="bg-white rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日時</TableHead>
              <TableHead>管理者</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>対象</TableHead>
              <TableHead>詳細</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                <TableCell className="text-sm">{admins.get(r.admin_user_id) ?? `${r.admin_user_id.slice(0, 8)}…`}</TableCell>
                <TableCell className="font-mono text-xs">{r.action}</TableCell>
                <TableCell>{targetLink(r.target_type, r.target_id)}</TableCell>
                <TableCell className="text-xs text-gray-600 max-w-md truncate">{jsonText(r.metadata)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows === null && <Empty text="読み込み中…" />}
        {rows?.length === 0 && <Empty text="ログはありません" />}
      </div>
    </div>
  );
};

const ROLES: AdminRole[] = ['super_admin', 'moderator', 'support'];
const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'スーパー管理者（全権限）',
  moderator: 'モデレーター（会員・通報・本人確認・カテゴリー）',
  support: 'サポート（閲覧のみ）',
};

export const AdminsPage: React.FC = () => {
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  const role = useAdminRole();
  const [rows, setRows] = useState<AdminAdminRow[] | null>(null);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('moderator');
  const [busy, setBusy] = useState(false);
  const isSuper = role === 'super_admin';

  const load = useCallback(() => {
    listAdmins().then(setRows).catch((e) => {
      setRows([]);
      toast({ title: '取得に失敗しました', description: errorMessage(e), variant: 'destructive' });
    });
  }, [toast]);

  useEffect(load, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await upsertAdmin(email.trim(), newRole);
      toast({ title: `${email} を ${newRole} に設定しました` });
      setEmail('');
      load();
    } catch (err) {
      toast({ title: '追加に失敗しました', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (a: AdminAdminRow, r: AdminRole) => {
    if (!a.email) return;
    try {
      await upsertAdmin(a.email, r);
      load();
    } catch (err) {
      toast({ title: '変更に失敗しました', description: errorMessage(err), variant: 'destructive' });
    }
  };

  const remove = async (a: AdminAdminRow) => {
    if (!window.confirm(`${a.email ?? a.user_id} の管理者権限を削除しますか？`)) return;
    try {
      await removeAdmin(a.user_id);
      load();
    } catch (err) {
      toast({ title: '削除に失敗しました', description: errorMessage(err), variant: 'destructive' });
    }
  };

  return (
    <div>
      <PageHeader title="管理者" />
      <ul className="text-xs text-gray-600 mb-4 space-y-0.5">
        {ROLES.map((r) => <li key={r}><span className="font-mono">{r}</span>: {ROLE_LABELS[r]}</li>)}
      </ul>
      {isSuper && (
        <form onSubmit={add} className="flex gap-2 mb-4 flex-wrap">
          <Input type="email" required className="w-72" placeholder="登録済み会員のメールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm" value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <Button type="submit" size="sm" disabled={busy}>管理者に追加</Button>
        </form>
      )}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>メール</TableHead>
              <TableHead>ニックネーム</TableHead>
              <TableHead>権限</TableHead>
              <TableHead>登録日</TableHead>
              {isSuper && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((a) => (
              <TableRow key={a.user_id}>
                <TableCell className="text-sm">{a.email}{a.user_id === user?.id && <span className="ml-1 text-xs text-gray-400">(自分)</span>}</TableCell>
                <TableCell>{a.nickname ?? '-'}</TableCell>
                <TableCell>
                  {isSuper && a.user_id !== user?.id ? (
                    <select className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm" value={a.role} onChange={(e) => changeRole(a, e.target.value as AdminRole)}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className="font-mono text-xs">{a.role}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{fmtDate(a.created_at)}</TableCell>
                {isSuper && (
                  <TableCell>
                    {a.user_id !== user?.id && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(a)}>削除</Button>}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows === null && <Empty text="読み込み中…" />}
      </div>
    </div>
  );
};
