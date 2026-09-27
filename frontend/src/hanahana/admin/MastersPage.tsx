import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { listMaster, saveMaster, type MasterInput, type MasterRow, type MasterTable } from '../api/admin';
import { COUNTRY_LABELS } from '../labels';
import type { Country } from '../types';
import { useAdminRole } from './context';
import { Empty, PageHeader } from './common';
import { errorMessage } from './labels';

const TABLES: { key: MasterTable; label: string; codeLabel: string }[] = [
  { key: 'interests', label: '趣味・興味', codeLabel: 'slug' },
  { key: 'purposes', label: '利用目的', codeLabel: 'slug' },
  { key: 'languages', label: '言語', codeLabel: 'コード (ISO)' },
  { key: 'regions', label: '地域', codeLabel: 'コード' },
];

const EMPTY: MasterInput = { code: '', name_ja: '', name_ko: '', name_en: '', sort_order: 0, is_active: true, category: null, country: 'JP' };

const MastersPage: React.FC = () => {
  const { toast } = useToast();
  const role = useAdminRole();
  const [table, setTable] = useState<MasterTable>('interests');
  const [rows, setRows] = useState<MasterRow[] | null>(null);
  const [editing, setEditing] = useState<{ key: string | null; input: MasterInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = TABLES.find((t) => t.key === table)!;
  const canEdit = role !== 'support';

  const load = useCallback(() => {
    setRows(null);
    listMaster(table).then(setRows).catch((e) => {
      setRows([]);
      toast({ title: '取得に失敗しました', description: errorMessage(e), variant: 'destructive' });
    });
  }, [table, toast]);

  useEffect(load, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await saveMaster(table, editing.key, editing.input);
      toast({ title: '保存しました' });
      setEditing(null);
      load();
    } catch (e) {
      toast({ title: '保存に失敗しました', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (r: MasterRow) => {
    try {
      await saveMaster(table, r.key, { ...r, is_active: !r.is_active });
      load();
    } catch (e) {
      toast({ title: '更新に失敗しました', description: errorMessage(e), variant: 'destructive' });
    }
  };

  const set = (patch: Partial<MasterInput>) => setEditing((s) => (s ? { ...s, input: { ...s.input, ...patch } } : s));

  return (
    <div>
      <PageHeader title="カテゴリー管理">
        {canEdit && <Button size="sm" onClick={() => setEditing({ key: null, input: { ...EMPTY, sort_order: (rows?.length ?? 0) + 1 } })}>＋ 追加</Button>}
      </PageHeader>
      <div className="flex gap-1 mb-4 flex-wrap">
        {TABLES.map((t) => (
          <Button key={t.key} size="sm" variant={table === t.key ? 'default' : 'outline'} onClick={() => setTable(t.key)}>{t.label}</Button>
        ))}
      </div>
      {!canEdit && <p className="text-xs text-gray-500 mb-2">support 権限では閲覧のみ可能です。</p>}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>順</TableHead>
              {table === 'regions' && <TableHead>国</TableHead>}
              <TableHead>{meta.codeLabel}</TableHead>
              <TableHead>日本語</TableHead>
              <TableHead>한국어</TableHead>
              <TableHead>English</TableHead>
              {table === 'interests' && <TableHead>分類</TableHead>}
              <TableHead>有効</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.map((r) => (
              <TableRow key={r.key} className={r.is_active ? '' : 'opacity-50'}>
                <TableCell>{r.sort_order}</TableCell>
                {table === 'regions' && <TableCell>{r.country ? COUNTRY_LABELS[r.country] : '-'}</TableCell>}
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.name_ja}</TableCell>
                <TableCell>{r.name_ko}</TableCell>
                <TableCell>{r.name_en}</TableCell>
                {table === 'interests' && <TableCell>{r.category ?? '-'}</TableCell>}
                <TableCell><Switch checked={r.is_active} disabled={!canEdit} onCheckedChange={() => toggleActive(r)} /></TableCell>
                {canEdit && (
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ key: r.key, input: { ...r } })}>編集</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows === null && <Empty text="読み込み中…" />}
        {rows?.length === 0 && <Empty />}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.key ? '編集' : '追加'} — {meta.label}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              {table === 'regions' && (
                <div>
                  <Label>国</Label>
                  <select className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm" value={editing.input.country ?? 'JP'} onChange={(e) => set({ country: e.target.value as Country })}>
                    {(Object.keys(COUNTRY_LABELS) as Country[]).map((c) => <option key={c} value={c}>{COUNTRY_LABELS[c]}</option>)}
                  </select>
                </div>
              )}
              <div><Label>{meta.codeLabel}</Label><Input value={editing.input.code} disabled={table === 'languages' && !!editing.key} onChange={(e) => set({ code: e.target.value })} /></div>
              <div><Label>日本語</Label><Input value={editing.input.name_ja} onChange={(e) => set({ name_ja: e.target.value })} /></div>
              <div><Label>한국어</Label><Input value={editing.input.name_ko} onChange={(e) => set({ name_ko: e.target.value })} /></div>
              <div><Label>English</Label><Input value={editing.input.name_en} onChange={(e) => set({ name_en: e.target.value })} /></div>
              {table === 'interests' && <div><Label>分類</Label><Input value={editing.input.category ?? ''} onChange={(e) => set({ category: e.target.value || null })} /></div>}
              <div className="flex gap-4 items-end">
                <div className="w-28"><Label>表示順</Label><Input type="number" value={editing.input.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} /></div>
                <label className="flex items-center gap-2 text-sm pb-2"><Switch checked={editing.input.is_active} onCheckedChange={(v) => set({ is_active: v })} />有効</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>キャンセル</Button>
            <Button disabled={busy || !editing?.input.code || !editing?.input.name_ja} onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MastersPage;
