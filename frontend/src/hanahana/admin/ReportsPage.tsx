import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { listReports, resolveReport, setUserStatus, type AdminReportRow, type ReportStatus } from '../api/admin';
import { REPORT_REASON_LABELS } from '../labels';
import { useAdminRole } from './context';
import { Empty, PageHeader, Pager, ReportStatusBadge, StatusBadge } from './common';
import { REPORT_STATUS_LABELS, errorMessage, fmtDate } from './labels';

const SIZE = 30;
const FILTERS: (ReportStatus | 'all')[] = ['open', 'in_review', 'resolved', 'dismissed', 'all'];

const ReportCard: React.FC<{ r: AdminReportRow; canModerate: boolean; onDone: () => void }> = ({ r, canModerate, onDone }) => {
  const { toast } = useToast();
  const [note, setNote] = useState(r.admin_note ?? '');
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: ok });
      onDone();
    } catch (e) {
      toast({ title: '失敗しました', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const resolve = (s: ReportStatus) => act(() => resolveReport(r.id, s, note || undefined), `通報を「${REPORT_STATUS_LABELS[s]}」にしました`);
  const suspend = () =>
    act(async () => {
      await setUserStatus(r.reported_user_id, 'suspended', `通報対応 (${r.id})`);
      await resolveReport(r.id, 'resolved', note || '利用停止で対応');
    }, '対象会員を利用停止にしました');

  const closed = r.status === 'resolved' || r.status === 'dismissed';

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <ReportStatusBadge status={r.status} />
          <span className="font-medium">{REPORT_REASON_LABELS[r.reason]}</span>
          <span className="text-xs text-gray-500 ml-auto">{fmtDate(r.created_at)}</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-xs text-gray-500">通報対象: </span>
            <Link to={`/app/admin/users/${r.reported_user_id}`} className="text-blue-600 hover:underline">{r.reported_nickname ?? r.reported_user_id}</Link>{' '}
            <StatusBadge status={r.reported_status} />
          </div>
          <div>
            <span className="text-xs text-gray-500">通報者: </span>
            <Link to={`/app/admin/users/${r.reporter_id}`} className="text-blue-600 hover:underline">{r.reporter_nickname ?? r.reporter_id}</Link>
          </div>
        </div>
        {r.detail && <p className="text-sm bg-gray-50 rounded p-2 whitespace-pre-wrap">{r.detail}</p>}
        {r.message_body && (
          <p className="text-sm border-l-4 border-amber-300 pl-2 text-gray-700 whitespace-pre-wrap">
            <span className="text-xs text-gray-500">対象メッセージ: </span>{r.message_body}
          </p>
        )}
        {closed ? (
          <p className="text-xs text-gray-500">対応: {fmtDate(r.resolved_at)}{r.admin_note && ` / メモ: ${r.admin_note}`}</p>
        ) : (
          canModerate && (
            <div className="space-y-2 pt-1">
              <Textarea rows={2} placeholder="対応メモ" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {r.status === 'open' && <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve('in_review')}>対応中にする</Button>}
                <Button size="sm" disabled={busy} onClick={() => resolve('resolved')}>解決</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => resolve('dismissed')}>却下</Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => window.confirm('対象会員を利用停止にして通報を解決しますか？') && suspend()}>
                  利用停止して解決
                </Button>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
};

const ReportsPage: React.FC = () => {
  const { toast } = useToast();
  const role = useAdminRole();
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminReportRow[] | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    listReports(filter === 'all' ? undefined : filter, page, SIZE)
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

  return (
    <div>
      <PageHeader title="通報管理" />
      <div className="flex gap-1 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => { setFilter(f); setPage(1); }}>
            {f === 'all' ? 'すべて' : REPORT_STATUS_LABELS[f]}
          </Button>
        ))}
      </div>
      {rows === null && <Empty text="読み込み中…" />}
      {rows?.length === 0 && <Empty text="該当する通報はありません" />}
      <div className="space-y-3">
        {rows?.map((r) => <ReportCard key={r.id} r={r} canModerate={role !== 'support'} onDone={load} />)}
      </div>
      <Pager page={page} size={SIZE} total={total} onChange={setPage} />
    </div>
  );
};

export default ReportsPage;
