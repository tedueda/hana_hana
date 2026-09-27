import React, { useEffect, useState } from 'react';
import { BadgeCheck, Clock, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { formatDate, useI18n } from '../i18n';
import { useErrorMessage } from '../hooks';
import { fetchMyVerification, requestVerification, uploadVerificationDoc, type Verification } from '../api/profile';
import { fetchPublicSettings } from '../api/settings';
import { PageHeader } from './SettingsPage';
import type { MessageKey } from '../i18n/ja';

const STATUS: Record<Verification['status'], { key: MessageKey; icon: React.ElementType; cls: string }> = {
  unverified: { key: 'my.verify.unverified', icon: ShieldQuestion, cls: 'text-gray-500' },
  pending: { key: 'my.verify.pending', icon: Clock, cls: 'text-amber-600' },
  verified: { key: 'my.verify.verified', icon: BadgeCheck, cls: 'text-sky-600' },
  rejected: { key: 'my.verify.rejected', icon: ShieldAlert, cls: 'text-red-600' },
};

const DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const DOC_MAX_BYTES = 10 * 1024 * 1024;

const VerificationForm: React.FC<{ status: Verification['status']; onSubmitted: (v: Verification | null) => void }> = ({ status, onSubmitted }) => {
  const { t } = useI18n();
  const { user, profile } = useSupabaseAuth();
  const errMsg = useErrorMessage();
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState(profile?.birthdate ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [docPath, setDocPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retentionDays, setRetentionDays] = useState(90);

  useEffect(() => {
    fetchPublicSettings().then((s) => setRetentionDays(s.verification_doc_retention_days)).catch(() => undefined);
  }, []);

  const pickFile = (f: File | undefined) => {
    setError('');
    setDocPath(null);
    if (!f) return setFile(null);
    if (!DOC_TYPES.includes(f.type)) return setError(t('verification.docHint'));
    if (f.size > DOC_MAX_BYTES) return setError(t('verification.docHint'));
    setFile(f);
  };

  const submit = async () => {
    if (!user) return;
    if (!name.trim() || !birthdate || !file) return setError(t('verification.needAll'));
    setBusy(true);
    setError('');
    try {
      let path = docPath;
      if (!path) {
        try {
          path = await uploadVerificationDoc(user.id, file);
          setDocPath(path);
        } catch {
          setError(t('verification.uploadFailed'));
          return;
        }
      }
      await requestVerification(name.trim(), birthdate, path);
      onSubmitted(await fetchMyVerification());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">{t('verification.formTitle')}</h2>
      <p className="text-sm text-gray-600">{t('verification.formLead', { days: retentionDays })}</p>
      <div className="space-y-1.5">
        <Label htmlFor="vname">{t('verification.name')}</Label>
        <Input id="vname" value={name} maxLength={100} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vbirth">{t('verification.birthdate')}</Label>
        <Input id="vbirth" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vdoc">{t('verification.doc')}</Label>
        <Input id="vdoc" type="file" accept={DOC_TYPES.join(',')} className="h-11 py-2" onChange={(e) => pickFile(e.target.files?.[0])} />
        <p className="text-xs text-gray-500">{file ? t('verification.docSelected', { name: file.name }) : t('verification.docHint')}</p>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <Button className="w-full h-12 bg-rose-600 hover:bg-rose-700" disabled={busy} onClick={submit}>
        {busy ? t('verification.submitting') : status === 'rejected' ? t('verification.resubmit') : t('verification.submit')}
      </Button>
      <p className="text-xs text-gray-500">{t('verification.legalNote')}</p>
    </div>
  );
};

export const VerificationPage: React.FC = () => {
  const { t, locale } = useI18n();
  const [v, setV] = useState<Verification | null | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    fetchMyVerification().then(setV).catch(() => setV(null));
  }, []);

  const status = v?.status ?? 'unverified';
  const { key, icon: Icon, cls } = STATUS[status];

  return (
    <div className="space-y-4">
      <PageHeader title={t('verification.title')} back="/app/profile" />
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <p className="text-sm text-gray-700">{t('verification.lead')}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('verification.status')}</span>
          {v === undefined ? (
            <span className="text-sm text-gray-400">{t('common.loading')}</span>
          ) : (
            <span className={`flex items-center gap-1.5 font-medium ${cls}`}>
              <Icon className="w-5 h-5" aria-hidden />
              {t(key)}
            </span>
          )}
        </div>
        {submitted && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3" role="status">{t('verification.submitted')}</p>}
        {status === 'pending' && (
          <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">
            {t('verification.pendingLead', { date: v?.submitted_at ? formatDate(v.submitted_at, locale) : '' })}
          </p>
        )}
        {status === 'verified' && <p className="text-sm text-sky-800 bg-sky-50 rounded-xl p-3">{t('verification.verifiedLead')}</p>}
        {status === 'rejected' && v?.rejected_reason && (
          <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{t('verification.rejectedReason', { reason: v.rejected_reason })}</p>
        )}
      </div>
      {v !== undefined && (status === 'unverified' || status === 'rejected') && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <VerificationForm
            status={status}
            onSubmitted={(nv) => {
              setV(nv);
              setSubmitted(true);
            }}
          />
        </div>
      )}
    </div>
  );
};

export const PlusPage: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <PageHeader title={t('my.plus')} back="/app/profile" />
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <Badge variant="secondary">{t('my.tier.free')}</Badge>
        <p className="text-sm text-gray-700">{t('my.plusLead')}</p>
      </div>
    </div>
  );
};
