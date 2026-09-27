import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { listUsers, type AccountStatus, type AdminUserRow, type VerificationStatus } from '../api/admin';
import { NATIONALITY_LABELS } from '../labels';
import type { Nationality } from '../types';
import { Empty, PageHeader, Pager, StatusBadge, VerificationBadge } from './common';
import { STATUS_LABELS, VERIFICATION_LABELS, ageOf, errorMessage, fmtDate } from './labels';

const SIZE = 30;
const ACCOUNT_STATUSES = Object.keys(STATUS_LABELS) as AccountStatus[];
const VERIFICATION_STATUSES = Object.keys(VERIFICATION_LABELS) as VerificationStatus[];
const NATIONALITIES = Object.keys(NATIONALITY_LABELS) as Nationality[];

const isIn = <T extends string>(v: string | null, list: readonly T[]): v is T => v !== null && (list as readonly string[]).includes(v);

const UsersPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [queryInput, setQueryInput] = useState(params.get('q') ?? '');

  const page = Number(params.get('page') ?? 1);
  const query = params.get('q') ?? '';
  const statusParam = params.get('status');
  const status = isIn(statusParam, ACCOUNT_STATUSES) ? statusParam : undefined;
  const natParam = params.get('nationality');
  const nationality = isIn(natParam, NATIONALITIES) ? natParam : undefined;
  const verParam = params.get('verification');
  const verification = isIn(verParam, VERIFICATION_STATUSES) ? verParam : undefined;

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      if (!('page' in patch)) next.delete('page');
      setParams(next);
    },
    [params, setParams],
  );

  useEffect(() => {
    setRows(null);
    listUsers({ query, status, nationality, verification, page, size: SIZE })
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
      })
      .catch((e) => {
        setRows([]);
        toast({ title: '取得に失敗しました', description: errorMessage(e), variant: 'destructive' });
      });
  }, [query, status, nationality, verification, page, toast]);

  const select = (value: string | undefined, onChange: (v: string | undefined) => void, options: [string, string][], all: string) => (
    <select className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{all}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );

  return (
    <div>
      <PageHeader title="会員管理" />
      <form
        className="flex flex-wrap gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: queryInput.trim() || undefined });
        }}
      >
        <Input className="w-64" placeholder="ニックネーム / メール / ID" value={queryInput} onChange={(e) => setQueryInput(e.target.value)} />
        {select(status, (v) => update({ status: v }), ACCOUNT_STATUSES.map((s) => [s, STATUS_LABELS[s]]), '状態: すべて')}
        {select(nationality, (v) => update({ nationality: v }), NATIONALITIES.map((n) => [n, NATIONALITY_LABELS[n]]), '国籍: すべて')}
        {select(verification, (v) => update({ verification: v }), VERIFICATION_STATUSES.map((s) => [s, VERIFICATION_LABELS[s]]), '本人確認: すべて')}
        <Button type="submit" size="sm">検索</Button>
      </form>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ニックネーム</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>国籍</TableHead>
              <TableHead>年齢</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>本人確認</TableHead>
              <TableHead>通報</TableHead>
              <TableHead>最終アクティブ</TableHead>
              <TableHead>登録日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link to={`/app/admin/users/${u.id}`} className="text-blue-600 hover:underline font-medium">{u.nickname}</Link>
                  {!u.onboarding_completed && <span className="ml-1 text-[10px] text-gray-400">(未完了)</span>}
                </TableCell>
                <TableCell className="text-xs">{u.email}</TableCell>
                <TableCell>{NATIONALITY_LABELS[u.nationality]}</TableCell>
                <TableCell>{ageOf(u.birthdate)}</TableCell>
                <TableCell><StatusBadge status={u.status} /></TableCell>
                <TableCell><VerificationBadge status={u.verification_status} /></TableCell>
                <TableCell className={Number(u.report_count) > 0 ? 'text-red-600 font-semibold' : ''}>{u.report_count}</TableCell>
                <TableCell className="text-xs">{fmtDate(u.last_active_at)}</TableCell>
                <TableCell className="text-xs">{fmtDate(u.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows === null && <Empty text="読み込み中…" />}
        {rows?.length === 0 && <Empty />}
      </div>
      <Pager page={page} size={SIZE} total={total} onChange={(p) => update({ page: String(p) })} />
    </div>
  );
};

export default UsersPage;
