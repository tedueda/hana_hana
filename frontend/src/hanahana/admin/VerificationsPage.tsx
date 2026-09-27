import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { listUsers, setVerification, type AdminUserRow, type VerificationStatus } from '../api/admin';
import { NATIONALITY_LABELS } from '../labels';
import { useAdminRole } from './context';
import { Empty, PageHeader, Pager, VerificationBadge } from './common';
import { VERIFICATION_LABELS, ageOf, errorMessage, fmtDate } from './labels';

const SIZE = 30;
const FILTERS: VerificationStatus[] = ['pending', 'verified', 'rejected', 'unverified'];

const VerificationsPage: React.FC = () => {
  const { toast } = useToast();
  const role = useAdminRole();
  const [filter, setFilter] = useState<VerificationStatus>('pending');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listUsers({ verification: filter, page, size: SIZE })
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch((e) => {
        setRows([]);
        toast({ title: '取得に失敗しました', description: errorMessage(e), variant: 'destructive' });
      });
  }, [filter, page, toast]);

  useEffect(load, [load]);

  const decide = async (u: AdminUserRow, status: VerificationStatus) => {
    const reason = status === 'rejected' ? window.prompt('却下理由を入力してください') : undefined;
    if (status === 'rejected' && reason === null) return;
    setBusy(u.id);
    try {
      await setVerification(u.id, status, reason || undefined);
      toast({ title: `${u.nickname} を「${VERIFICATION_LABELS[status]}」にしました` });
      load();
    } catch (e) {
      toast({ title: '失敗しました', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="本人確認" />
      <div className="flex gap-1 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => { setFilter(f); setPage(1); }}>
            {VERIFICATION_LABELS[f]}
          </Button>
        ))}
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>会員</TableHead>
              <TableHead>国籍</TableHead>
              <TableHead>年齢</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>登録日</TableHead>
              {role !== 'support' && <TableHead>操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link to={`/app/admin/users/${u.id}`} className="text-blue-600 hover:underline font-medium">{u.nickname}</Link>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </TableCell>
                <TableCell>{NATIONALITY_LABELS[u.nationality]}</TableCell>
                <TableCell>{ageOf(u.birthdate)}</TableCell>
                <TableCell><VerificationBadge status={u.verification_status} /></TableCell>
                <TableCell className="text-xs">{fmtDate(u.created_at)}</TableCell>
                {role !== 'support' && (
                  <TableCell>
                    <div className="flex gap-1">
                      {u.verification_status !== 'verified' && <Button size="sm" disabled={busy === u.id} onClick={() => decide(u, 'verified')}>承認</Button>}
                      {u.verification_status !== 'rejected' && <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => decide(u, 'rejected')}>却下</Button>}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows === null && <Empty text="読み込み中…" />}
        {rows?.length === 0 && <Empty />}
      </div>
      <Pager page={page} size={SIZE} total={total} onChange={setPage} />
    </div>
  );
};

export default VerificationsPage;
