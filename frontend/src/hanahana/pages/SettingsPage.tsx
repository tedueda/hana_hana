import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft, FileText, HelpCircle, Info, KeyRound, Languages, ShieldOff, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { formatDate, LANGS, LANG_NAMES, useI18n, type Lang } from '../i18n';
import { useErrorMessage } from '../hooks';
import { updateMyProfile } from '../api/profile';
import {
  DEFAULT_PUBLIC_SETTINGS,
  fetchMyBlocks,
  fetchMySettings,
  fetchPublicSettings,
  requestAccountDeletion,
  unblockUser,
  upsertMySettings,
  type BlockedUser,
  type PublicSettings,
  type UserSettings,
  type UserSettingsUpdate,
} from '../api/settings';
import { Avatar } from '../components/ProfileCard';
import { MenuRow } from './MyProfilePage';
import type { MessageKey } from '../i18n/ja';

export const PageHeader: React.FC<{ title: string; back?: string }> = ({ title, back = '/app/settings' }) => (
  <div className="flex items-center gap-1 -ml-2">
    <Button asChild variant="ghost" size="icon" className="h-11 w-11">
      <Link to={back} aria-label="back"><ChevronLeft className="w-6 h-6" /></Link>
    </Button>
    <h1 className="text-xl font-bold">{title}</h1>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-xs font-semibold text-gray-500 px-1">{title}</h2>
    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">{children}</div>
  </section>
);

const ToggleRow: React.FC<{ label: string; lead?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }> = ({
  label,
  lead,
  checked,
  disabled,
  onChange,
}) => {
  const id = React.useId();
  return (
    <div className="flex items-center gap-3 px-4 min-h-[52px] py-2">
      <div className="flex-1">
        <Label htmlFor={id} className="text-sm font-normal">{label}</Label>
        {lead && <p className="text-xs text-gray-500 mt-0.5">{lead}</p>}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
};

function useMySettings() {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  useEffect(() => {
    if (user) fetchMySettings(user.id).then(setSettings).catch(() => undefined);
  }, [user]);
  const save = async (patch: UserSettingsUpdate) => {
    if (!user) return;
    const prev = settings;
    setSettings((s) => (s ? { ...s, ...patch } : s));
    try {
      setSettings(await upsertMySettings(user.id, patch));
    } catch (e) {
      setSettings(prev);
      toast({ title: t('common.errorTitle'), description: errMsg(e), variant: 'destructive' });
    }
  };
  return { settings, save };
}

const SettingsPage: React.FC = () => {
  const { user, profile, refreshProfile } = useSupabaseAuth();
  const { t, lang, setLang } = useI18n();
  const [pub, setPub] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const { settings, save } = useMySettings();

  useEffect(() => {
    fetchPublicSettings().then(setPub).catch(() => undefined);
  }, []);

  const changeLang = async (l: Lang) => {
    setLang(l);
    if (user && profile?.preferred_ui_lang !== l) {
      await updateMyProfile(user.id, { preferred_ui_lang: l }).catch(() => undefined);
      await refreshProfile();
    }
  };

  const autoAllowed = pub.translation_enabled && pub.translation_auto_enabled;

  return (
    <div className="space-y-5">
      <PageHeader title={t('settings.title')} back="/app/profile" />

      <Section title={t('settings.uiLang')}>
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs text-gray-500">{t('settings.uiLangLead')}</p>
          <div className="grid grid-cols-2 gap-2">
            {LANGS.map((l) => (
              <Button key={l} type="button" lang={l} variant={lang === l ? 'default' : 'outline'} className="h-11" onClick={() => changeLang(l)}>
                {LANG_NAMES[l]}
              </Button>
            ))}
          </div>
        </div>
      </Section>

      {pub.translation_enabled && (
        <Section title={t('settings.translation')}>
          <ToggleRow
            label={t('settings.autoTranslate')}
            lead={autoAllowed ? t('settings.autoTranslateLead') : t('settings.autoTranslateDisabled')}
            checked={autoAllowed && (settings?.auto_translate ?? false)}
            disabled={!autoAllowed || !settings}
            onChange={(v) => save({ auto_translate: v })}
          />
          <div className="px-4 py-3 space-y-1.5">
            <Label className="text-sm font-normal">{t('settings.translateTarget')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={!settings?.translate_target_lang ? 'default' : 'outline'}
                size="sm"
                className="h-10"
                disabled={!settings}
                onClick={() => save({ translate_target_lang: null })}
              >
                {t('settings.translateTargetAuto')}
              </Button>
              {LANGS.map((l) => (
                <Button
                  key={l}
                  type="button"
                  lang={l}
                  size="sm"
                  className="h-10"
                  variant={settings?.translate_target_lang === l ? 'default' : 'outline'}
                  disabled={!settings}
                  onClick={() => save({ translate_target_lang: l })}
                >
                  {LANG_NAMES[l]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-gray-500 flex items-start gap-1 pt-1">
              <Languages className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
              {t('settings.translationNotice')}
            </p>
          </div>
        </Section>
      )}

      <Section title={t('settings.notifications')}>
        <ToggleRow label={t('settings.notify.like')} checked={settings?.notify_like ?? true} disabled={!settings} onChange={(v) => save({ notify_like: v })} />
        <ToggleRow label={t('settings.notify.match')} checked={settings?.notify_match ?? true} disabled={!settings} onChange={(v) => save({ notify_match: v })} />
        <ToggleRow label={t('settings.notify.message')} checked={settings?.notify_message ?? true} disabled={!settings} onChange={(v) => save({ notify_message: v })} />
        <ToggleRow label={t('settings.notify.email')} checked={settings?.notify_email ?? true} disabled={!settings} onChange={(v) => save({ notify_email: v })} />
      </Section>

      <Section title={t('settings.safety')}>
        <MenuRow to="/app/settings/blocks" icon={ShieldOff} label={t('settings.blocks')} />
      </Section>

      <Section title={t('settings.account')}>
        <MenuRow to="/app/settings/password" icon={KeyRound} label={t('settings.changePassword')} />
        <MenuRow to="/app/settings/delete" icon={UserX} label={t('settings.deleteAccount')} danger />
      </Section>

      <Section title={t('settings.legal')}>
        <MenuRow to="/app/terms" icon={FileText} label={t('settings.terms')} value={t('settings.version', { version: pub.terms_version })} />
        <MenuRow to="/app/privacy" icon={FileText} label={t('settings.privacy')} value={t('settings.version', { version: pub.privacy_version })} />
        <MenuRow to="/app/legal-notice" icon={FileText} label={t('legal.legalNotice')} />
        <MenuRow to="/app/about" icon={Info} label={t('public.nav.about')} />
        <MenuRow to="/app/help" icon={HelpCircle} label={t('settings.help')} />
      </Section>

      <p className="text-center text-[11px] text-gray-400 flex items-center justify-center gap-1">
        <Bell className="w-3 h-3" aria-hidden /> {user?.email}
      </p>
    </div>
  );
};

export const BlocksPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const errMsg = useErrorMessage();
  const [items, setItems] = useState<BlockedUser[] | null>(null);

  const load = () => fetchMyBlocks().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    void load();
  }, []);

  const unblock = async (b: BlockedUser) => {
    if (!user) return;
    if (!window.confirm(t('settings.unblockConfirm', { name: b.nickname ?? '' }))) return;
    try {
      await unblockUser(user.id, b.blocked_id);
      toast({ title: t('settings.unblocked') });
      await load();
    } catch (e) {
      toast({ title: t('common.errorTitle'), description: errMsg(e), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('settings.blocks')} />
      {items === null && <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>}
      {items?.length === 0 && <p className="text-center text-gray-500 py-10">{t('settings.blocksEmpty')}</p>}
      <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
        {items?.map((b) => (
          <li key={b.blocked_id} className="flex items-center gap-3 px-3 py-3">
            <Avatar path={b.primary_photo_path} name={b.nickname} className="w-12 h-12 rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{b.nickname ?? t('matches.hiddenUser')}</p>
              <p className="text-xs text-gray-500">{t('settings.blockedAt', { date: formatDate(b.created_at, locale) })}</p>
            </div>
            <Button variant="outline" size="sm" className="h-10" onClick={() => unblock(b)}>{t('settings.unblock')}</Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ChangePasswordPage: React.FC = () => {
  const { updatePassword } = useSupabaseAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const errMsg = useErrorMessage();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) {
      setError(t('settings.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updatePassword(pw);
      toast({ title: t('settings.passwordChanged') });
      navigate('/app/settings');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('settings.changePassword')} />
      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pw">{t('auth.newPassword')}</Label>
          <Input id="pw" type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw2">{t('settings.passwordConfirm')}</Label>
          <Input id="pw2" type="password" autoComplete="new-password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-11" />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button type="submit" className="w-full h-11" disabled={busy}>{busy ? t('common.saving') : t('auth.change')}</Button>
      </form>
    </div>
  );
};

export const DeleteAccountPage: React.FC = () => {
  const { signOut } = useSupabaseAuth();
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const navigate = useNavigate();
  const [pub, setPub] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [word, setWord] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchPublicSettings().then(setPub).catch(() => undefined);
  }, []);

  const points: MessageKey[] = ['settings.delete.p1', 'settings.delete.p2', 'settings.delete.p3'];
  const confirmWord = t('settings.delete.word');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await requestAccountDeletion();
      setDone(true);
      await signOut();
      window.setTimeout(() => navigate('/app/welcome', { replace: true }), 2500);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="py-16 text-center text-gray-700 px-4">
        <p>{t('settings.delete.done')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('settings.delete.title')} />
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <p className="text-sm">{t('settings.delete.lead')}</p>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          {points.map((k) => <li key={k}>{t(k)}</li>)}
          <li>{t('settings.delete.p4', { days: pub.account_purge_days })}</li>
        </ul>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t('settings.delete.typeConfirm')}</Label>
          <Input id="confirm" value={word} onChange={(e) => setWord(e.target.value)} className="h-11" autoComplete="off" />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button variant="destructive" className="w-full h-11" disabled={busy || word.trim() !== confirmWord} onClick={submit}>
          {t('settings.delete.button')}
        </Button>
        <Button asChild variant="ghost" className="w-full h-11"><Link to="/app/settings">{t('common.cancel')}</Link></Button>
      </div>
    </div>
  );
};

export default SettingsPage;
