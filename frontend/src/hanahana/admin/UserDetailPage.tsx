import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { photoUrl } from '../api/profile';
import { getUserDetail, jsonText, setUserStatus, setVerification, type AccountStatus, type AdminUserDetail, type VerificationStatus } from '../api/admin';
import { COUNTRY_LABELS, GENDER_LABELS, LEVEL_LABELS, NATIONALITY_LABELS } from '../labels';
import { useAdminRole } from './context';
import { Empty, PageHeader, StatusBadge, VerificationBadge } from './common';
import { STATUS_LABELS, VERIFICATION_LABELS, ageOf, errorMessage, fmtDate } from './labels';

const STAT_LABELS: Record<string, string> = {
  likes_sent: 'いいね送信',
  likes_received: 'いいね受信',
  matches: 'マッチ',
  messages_sent: 'メッセージ送信',
  reports_received: '被通報',
  reports_made: '通報',
  blocked_by: 'ブロックされた数',
};

const SignedPhoto: React.FC<{ path: string }> = ({ path }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    photoUrl(path).then(setUrl);
  }, [path]);
  return url ? <img src={url} alt="" className="w-20 h-20 object-cover rounded" /> : <div className="w-20 h-20 bg-gray-100 rounded" />;
};

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="text-sm">{value ?? '-'}</dd>
  </div>
);

const UserDetailPage: React.FC = () => {
  const { userId = '' } = useParams();
  const { toast } = useToast();
  const role = useAdminRole();
  const [d, setD] = useState<AdminUserDetail | null | undefined>(undefined);
  const [status, setStatus] = useState<AccountStatus>('active');
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [verStatus, setVerStatus] = useState<VerificationStatus>('verified');
  const [verReason, setVerReason] = useState('');
  const [busy, setBusy] = useState(false);

  const canModerate = role === 'super_admin' || role === 'moderator';

  const load = useCallback(() => {
    getUserDetail(userId)
      .then((r) => {
        setD(r);
        if (r) {
          setStatus(r.profile.status);
          setReason(r.profile.status_reason ?? '');
          setUntil(r.profile.suspended_until ? r.profile.suspended_until.slice(0, 16) : '');
        }
      })
      .catch((e) => {
        setD(null);
        toast({ title: '取得に失敗しました', description: errorMessage(e), variant: 'destructive' });
      });
  }, [userId, toast]);

  useEffect(load, [load]);

  const applyStatus = async () => {
    if (!d) return;
    if ((status === 'banned' || status === 'deleted') && !window.confirm(`本当に「${STATUS_LABELS[status]}」にしますか？`)) return;
    setBusy(true);
    try {
      await setUserStatus(d.profile.id, status, reason || undefined, status === 'suspended' && until ? new Date(until).toISOString() : undefined);
      toast({ title: `状態を「${STATUS_LABELS[status]}」に変更しました` });
      load();
    } catch (e) {
      toast({ title: '変更に失敗しました', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const applyVerification = async () => {
    if (!d) return;
    setBusy(true);
    try {
      await setVerification(d.profile.id, verStatus, verReason || undefined);
      toast({ title: `本人確認を「${VERIFICATION_LABELS[verStatus]}」にしました` });
      load();
    } catch (e) {
      toast({ title: '変更に失敗しました', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (d === undefined) return <Empty text="読み込み中…" />;
  if (d === null) return <Empty text="会員が見つかりません" />;

  const p = d.profile;
  return (
    <div className="space-y-4">
      <PageHeader title={p.nickname ?? '(未設定)'}>
        <StatusBadge status={p.status} />
        <VerificationBadge status={d.verification?.status ?? null} />
        <Link to="/app/admin/users" className="text-sm text-blue-600 hover:underline self-center">← 一覧へ</Link>
      </PageHeader>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">プロフィール</CardTitle></CardHeader>
          <CardContent>
            {d.photos.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto">
                {d.photos.map((ph) => (
                  <SignedPhoto key={ph.id} path={ph.storage_path} />
                ))}
              </div>
            )}
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="ID" value={<span className="font-mono text-xs">{p.id}</span>} />
              <Field label="メール" value={d.email} />
              <Field label="メール確認" value={fmtDate(d.email_confirmed_at)} />
              <Field label="性別" value={p.gender ? GENDER_LABELS[p.gender] : null} />
              <Field label="年齢" value={ageOf(p.birthdate)} />
              <Field label="国籍" value={p.nationality ? NATIONALITY_LABELS[p.nationality] : null} />
              <Field label="居住国" value={p.residence_country ? COUNTRY_LABELS[p.residence_country] : null} />
              <Field label="職業" value={p.occupation} />
              <Field label="会員区分" value={p.member_tier} />
              <Field label="公開" value={p.is_public ? '公開' : '非公開'} />
              <Field label="登録" value={fmtDate(p.created_at)} />
              <Field label="最終ログイン" value={fmtDate(d.last_sign_in_at)} />
              <Field label="最終アクティブ" value={fmtDate(p.last_active_at)} />
              <Field label="言語" value={d.languages.map((l) => `${l.language_code} (${l.role}/${LEVEL_LABELS[l.level]})`).join(', ') || '-'} />
              <Field label="目的" value={d.purposes.join(', ') || '-'} />
              <Field label="趣味" value={d.interests.join(', ') || '-'} />
            </dl>
            {p.bio && (
              <div className="mt-3">
                <p className="text-xs text-gray-500">自己紹介</p>
                <p className="text-sm whitespace-pre-wrap">{p.bio}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">活動状況</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              {Object.entries(d.stats).map(([k, v]) => (
                <Field key={k} label={STAT_LABELS[k] ?? k} value={v} />
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      {canModerate && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">アカウント状態の変更</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <select className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as AccountStatus)}>
                {(Object.keys(STATUS_LABELS) as AccountStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              {status === 'suspended' && (
                <div>
                  <label className="text-xs text-gray-500">停止期限（空欄で無期限）</label>
                  <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
                </div>
              )}
              <Textarea placeholder="理由（内部メモ）" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              <Button size="sm" disabled={busy} onClick={applyStatus} variant={status === 'banned' || status === 'deleted' ? 'destructive' : 'default'}>
                状態を変更
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">本人確認</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {d.verification && (
                <p className="text-xs text-gray-500">
                  現在: {VERIFICATION_LABELS[d.verification.status]} / 申請名 {d.verification.submitted_name ?? '-'} / 確認日 {fmtDate(d.verification.verified_at)} / 試行 {d.verification.attempt_count}
                  {d.verification.rejected_reason && ` / 却下理由: ${d.verification.rejected_reason}`}
                </p>
              )}
              <select className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm" value={verStatus} onChange={(e) => setVerStatus(e.target.value as VerificationStatus)}>
                {(Object.keys(VERIFICATION_LABELS) as VerificationStatus[]).map((s) => (
                  <option key={s} value={s}>{VERIFICATION_LABELS[s]}</option>
                ))}
              </select>
              <Textarea placeholder="却下理由 など" value={verReason} onChange={(e) => setVerReason(e.target.value)} rows={2} />
              <Button size="sm" disabled={busy} onClick={applyVerification}>本人確認を更新</Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">管理操作ログ</CardTitle></CardHeader>
        <CardContent>
          {d.audit.length === 0 && <p className="text-sm text-gray-500">ログはありません</p>}
          <ul className="text-sm space-y-1">
            {d.audit.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="text-xs text-gray-500 w-36 shrink-0">{fmtDate(a.created_at)}</span>
                <span className="font-mono text-xs">{a.action}</span>
                <span className="text-xs text-gray-600 truncate">{jsonText(a.metadata)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserDetailPage;
