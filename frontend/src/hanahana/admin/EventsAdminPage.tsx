import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  adminFetchEventRegistrations, adminFetchEvents, adminUpsertEvent,
  type AdminEvent, type AdminEventInput, type AdminEventRegistration,
} from '../api/premium';
import { Empty, PageHeader } from './common';
import { errorMessage, fmtDate } from './labels';

const toLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

const EMPTY: AdminEventInput = {
  title_ja: '', title_ko: '', description_ja: '', description_ko: '', location_ja: '', location_ko: '',
  is_online: false, starts_at: '', ends_at: null, capacity: null, price_jpy: 0, early_access_hours: null, published: false,
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block text-xs text-gray-600 space-y-1"><span>{label}</span>{children}</label>
);

const EventForm: React.FC<{ initial: AdminEventInput; onSaved: () => void; onCancel: () => void }> = ({ initial, onSaved, onCancel }) => {
  const { toast } = useToast();
  const [f, setF] = useState<AdminEventInput>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof AdminEventInput>(k: K, v: AdminEventInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.title_ja || !f.title_ko || !f.starts_at) { toast({ title: 'タイトル(日/韓)と開始日時は必須です', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await adminUpsertEvent(f);
      toast({ title: '保存しました' });
      onSaved();
    } catch (e) {
      toast({ title: errorMessage(e, 'ja'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="タイトル (日本語)"><Input value={f.title_ja} onChange={(e) => set('title_ja', e.target.value)} /></Field>
        <Field label="タイトル (한국어)"><Input value={f.title_ko} onChange={(e) => set('title_ko', e.target.value)} /></Field>
        <Field label="説明 (日本語)"><Textarea rows={3} value={f.description_ja} onChange={(e) => set('description_ja', e.target.value)} /></Field>
        <Field label="説明 (한국어)"><Textarea rows={3} value={f.description_ko} onChange={(e) => set('description_ko', e.target.value)} /></Field>
        <Field label="場所 (日本語)"><Input value={f.location_ja ?? ''} onChange={(e) => set('location_ja', e.target.value || null)} /></Field>
        <Field label="場所 (한국어)"><Input value={f.location_ko ?? ''} onChange={(e) => set('location_ko', e.target.value || null)} /></Field>
        <Field label="開始日時"><Input type="datetime-local" value={toLocalInput(f.starts_at)} onChange={(e) => set('starts_at', fromLocalInput(e.target.value) ?? '')} /></Field>
        <Field label="終了日時"><Input type="datetime-local" value={toLocalInput(f.ends_at)} onChange={(e) => set('ends_at', fromLocalInput(e.target.value))} /></Field>
        <Field label="定員 (空=無制限)"><Input type="number" min={1} value={f.capacity ?? ''} onChange={(e) => set('capacity', e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="参加費 (円, 税込)"><Input type="number" min={0} value={f.price_jpy} onChange={(e) => set('price_jpy', Number(e.target.value) || 0)} /></Field>
        <Field label="プレミアム先行受付 (時間, 空=設定値 event_early_access_hours)"><Input type="number" min={0} value={f.early_access_hours ?? ''} onChange={(e) => set('early_access_hours', e.target.value ? Number(e.target.value) : null)} /></Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.is_online} onChange={(e) => set('is_online', e.target.checked)} />オンライン開催</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.published} onChange={(e) => set('published', e.target.checked)} />公開する</label>
        {f.id && <label className="flex items-center gap-2 text-red-700"><input type="checkbox" checked={!!f.canceled} onChange={(e) => set('canceled', e.target.checked)} />中止にする</label>}
      </div>
      <p className="text-xs text-gray-500">プレミアム割引率は plans.features.event_discount_pct（現在の設定）で自動適用されます。参加費の決済は今回の範囲外（当日/別途案内）です。</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy}>保存</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>閉じる</Button>
      </div>
    </CardContent></Card>
  );
};

const Registrations: React.FC<{ eventId: string }> = ({ eventId }) => {
  const [rows, setRows] = useState<AdminEventRegistration[] | null>(null);
  useEffect(() => { adminFetchEventRegistrations(eventId).then(setRows).catch(() => setRows([])); }, [eventId]);
  if (!rows) return <p className="text-xs text-gray-500">読み込み中…</p>;
  if (rows.length === 0) return <Empty text="申込はありません" />;
  return (
    <table className="w-full text-xs">
      <thead><tr className="text-left text-gray-500"><th className="py-1">ニックネーム</th><th>状態</th><th>参加費</th><th>割引</th><th>プラン</th><th>申込日時</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.user_id} className="border-t">
            <td className="py-1">{r.nickname}</td>
            <td>{r.status === 'registered' ? '申込済' : 'キャンセル'}</td>
            <td>¥{r.quoted_price_jpy.toLocaleString()}</td>
            <td>{r.discount_pct}%</td>
            <td>{r.plan_tier}</td>
            <td>{fmtDate(r.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const EventsAdminPage: React.FC = () => {
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [editing, setEditing] = useState<AdminEventInput | null>(null);
  const [openRegs, setOpenRegs] = useState<string | null>(null);

  const reload = useCallback(() => { adminFetchEvents().then(setEvents).catch(() => setEvents([])); }, []);
  useEffect(reload, [reload]);

  const edit = (e: AdminEvent) => setEditing({
    id: e.id, title_ja: e.title_ja, title_ko: e.title_ko, description_ja: e.description_ja, description_ko: e.description_ko,
    location_ja: e.location_ja, location_ko: e.location_ko, is_online: e.is_online, starts_at: e.starts_at, ends_at: e.ends_at,
    capacity: e.capacity, price_jpy: e.price_jpy, early_access_hours: e.early_access_hours,
    published: e.published_at !== null, canceled: e.canceled_at !== null,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="イベント管理">
        <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>新規作成</Button>
      </PageHeader>
      {editing && <EventForm initial={editing} onSaved={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />}
      {events && events.length === 0 && <Empty text="イベントはまだありません" />}
      <div className="space-y-2">
        {events?.map((e) => (
          <Card key={e.id}><CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{e.title_ja} <span className="text-gray-400 font-normal">/ {e.title_ko}</span></p>
                <p className="text-xs text-gray-500">{fmtDate(e.starts_at)} · {e.is_online ? 'オンライン' : e.location_ja} · 定員 {e.capacity ?? '無制限'} · ¥{e.price_jpy.toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-[11px]">
                <span className={`px-2 py-0.5 rounded-full ${e.published_at ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>{e.published_at ? '公開中' : '非公開'}</span>
                {e.canceled_at && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800">中止</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => edit(e)}>編集</Button>
              <Button size="sm" variant="ghost" onClick={() => setOpenRegs(openRegs === e.id ? null : e.id)}>申込一覧</Button>
            </div>
            {openRegs === e.id && <Registrations eventId={e.id} />}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
};

export default EventsAdminPage;
