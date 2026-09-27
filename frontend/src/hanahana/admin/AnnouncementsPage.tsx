import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { deleteAnnouncement, listAnnouncements, saveAnnouncement, type Announcement, type AnnouncementInsert } from '../api/admin';
import { useAdminRole } from './context';
import { Empty, PageHeader } from './common';
import { errorMessage, fmtDate } from './labels';

const toLocal = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 16) : '');
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

const EMPTY: AnnouncementInsert = { title_ja: '', title_ko: '', body_ja: '', body_ko: '', published_at: null, expires_at: null };

const AnnouncementsPage: React.FC = () => {
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  const role = useAdminRole();
  const [rows, setRows] = useState<Announcement[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; input: AnnouncementInsert } | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = role !== 'support';

  const load = useCallback(() => {
    listAnnouncements().then(setRows).catch((e) => {
      setRows([]);
      toast({ title: '取得に失敗しました', description: errorMessage(e), variant: 'destructive' });
    });
  }, [toast]);

  useEffect(load, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await saveAnnouncement(editing.id, editing.id ? editing.input : { ...editing.input, created_by: user?.id ?? null });
      toast({ title: '保存しました' });
      setEditing(null);
      load();
    } catch (e) {
      toast({ title: '保存に失敗しました', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm(`「${a.title_ja}」を削除しますか？`)) return;
    try {
      await deleteAnnouncement(a.id);
      load();
    } catch (e) {
      toast({ title: '削除に失敗しました', description: errorMessage(e), variant: 'destructive' });
    }
  };

  const set = (patch: Partial<AnnouncementInsert>) => setEditing((s) => (s ? { ...s, input: { ...s.input, ...patch } } : s));

  const state = (a: Announcement) => {
    const now = Date.now();
    if (!a.published_at || new Date(a.published_at).getTime() > now) return { label: '下書き / 予約', cls: 'bg-gray-200 text-gray-700' };
    if (a.expires_at && new Date(a.expires_at).getTime() < now) return { label: '期限切れ', cls: 'bg-amber-100 text-amber-800' };
    return { label: '公開中', cls: 'bg-emerald-100 text-emerald-800' };
  };

  return (
    <div>
      <PageHeader title="お知らせ">
        {canEdit && <Button size="sm" onClick={() => setEditing({ id: null, input: { ...EMPTY, published_at: new Date().toISOString() } })}>＋ 作成</Button>}
      </PageHeader>
      {rows === null && <Empty text="読み込み中…" />}
      {rows?.length === 0 && <Empty text="お知らせはありません" />}
      <div className="space-y-3">
        {rows?.map((a) => {
          const s = state(a);
          return (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded ${s.cls}`}>{s.label}</span>
                  <span className="font-medium">{a.title_ja}</span>
                  <span className="text-gray-400 text-sm">/ {a.title_ko}</span>
                  <span className="text-xs text-gray-500 ml-auto">公開 {fmtDate(a.published_at)} · 期限 {fmtDate(a.expires_at)}</span>
                </div>
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap line-clamp-3">{a.body_ja}</p>
                {canEdit && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing({ id: a.id, input: { ...a } })}>編集</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(a)}>削除</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? 'お知らせを編集' : 'お知らせを作成'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>タイトル (日本語)</Label><Input value={editing.input.title_ja} onChange={(e) => set({ title_ja: e.target.value })} /></div>
              <div><Label>제목 (한국어)</Label><Input value={editing.input.title_ko} onChange={(e) => set({ title_ko: e.target.value })} /></div>
              <div><Label>本文 (日本語)</Label><Textarea rows={6} value={editing.input.body_ja} onChange={(e) => set({ body_ja: e.target.value })} /></div>
              <div><Label>본문 (한국어)</Label><Textarea rows={6} value={editing.input.body_ko} onChange={(e) => set({ body_ko: e.target.value })} /></div>
              <div><Label>公開日時（空欄で下書き）</Label><Input type="datetime-local" value={toLocal(editing.input.published_at)} onChange={(e) => set({ published_at: toIso(e.target.value) })} /></div>
              <div><Label>掲載期限（任意）</Label><Input type="datetime-local" value={toLocal(editing.input.expires_at)} onChange={(e) => set({ expires_at: toIso(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>キャンセル</Button>
            <Button disabled={busy || !editing?.input.title_ja || !editing?.input.body_ja} onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnnouncementsPage;
