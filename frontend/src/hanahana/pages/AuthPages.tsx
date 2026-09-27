import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSupabase } from '@/lib/supabase';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { APP_NAME } from '../labels';
import { useI18n } from '../i18n';
import { useErrorMessage } from '../hooks';
import LangSwitch from '../components/LangSwitch';
import { DEFAULT_PUBLIC_SETTINGS, fetchPublicSettings, type PublicSettings } from '../api/settings';

const AuthCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 to-white px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))]">
    <Card className="w-full max-w-md shadow-lg border-rose-100">
      <CardHeader className="text-center space-y-2">
        <div className="flex items-center justify-between">
          <span className="w-24" />
          <p className="text-rose-600 font-bold tracking-wide">{APP_NAME}</p>
          <LangSwitch className="w-24 justify-center" />
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  </div>
);

export const LoginPage: React.FC = () => {
  const { signIn } = useSupabaseAuth();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title={t('auth.login')} description={t('auth.loginLead')}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button type="submit" className="w-full h-11 bg-rose-600 hover:bg-rose-700" disabled={busy}>
          {busy ? t('auth.loggingIn') : t('auth.login')}
        </Button>
        <div className="text-sm text-center text-gray-600 space-y-1">
          <p>
            <Link to="/app/forgot-password" className="underline">{t('auth.forgot')}</Link>
          </p>
          <p>
            {t('auth.noAccount')} <Link to="/app/register" className="text-rose-600 underline">{t('auth.register')}</Link>
          </p>
        </div>
      </form>
    </AuthCard>
  );
};

export const RegisterPage: React.FC = () => {
  const { signUp } = useSupabaseAuth();
  const { t, lang } = useI18n();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    fetchPublicSettings().then(setSettings).catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms || !agreeAge) {
      setError(t('auth.consentRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { needsEmailConfirm } = await signUp(email, password, nickname, lang, {
        terms_version: settings.terms_version,
        privacy_version: settings.privacy_version,
        min_age: settings.min_age,
        consented_at: new Date().toISOString(),
      });
      if (needsEmailConfirm) setSent(true);
      else navigate('/app/onboarding', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      const { error: err } = await getSupabase().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/app/login` },
      });
      if (err) throw err;
      setResent(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (sent) {
    return (
      <AuthCard title={t('auth.sentTitle')}>
        <p className="text-sm text-gray-700 text-center leading-relaxed">{t('auth.sentBody', { email })}</p>
        {error && <p className="text-sm text-red-600 mt-3 text-center" role="alert">{error}</p>}
        <Button variant="ghost" className="w-full mt-4 h-11" onClick={resend} disabled={resent}>
          {resent ? t('auth.resent') : t('auth.resend')}
        </Button>
        <Button asChild variant="outline" className="w-full mt-2 h-11">
          <Link to="/app/login">{t('auth.toLogin')}</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.register')} description={t('auth.registerLead')}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nickname">{t('auth.nickname')}</Label>
          <Input id="nickname" required maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t('auth.passwordHint')}</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </div>

        <div className="space-y-3 rounded-xl bg-gray-50 p-3">
          <label className="flex items-start gap-3 text-sm min-h-[44px] cursor-pointer">
            <Checkbox checked={agreeTerms} onCheckedChange={(v) => setAgreeTerms(v === true)} className="mt-0.5" aria-required />
            <span>
              {t('auth.agreeTerms')}{' '}
              <span className="block text-xs text-gray-500 mt-0.5">
                <Link to="/app/terms" target="_blank" className="underline">{t('legal.terms')}</Link>
                {' / '}
                <Link to="/app/privacy" target="_blank" className="underline">{t('legal.privacy')}</Link>
                {' '}({settings.terms_version})
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm min-h-[44px] cursor-pointer">
            <Checkbox checked={agreeAge} onCheckedChange={(v) => setAgreeAge(v === true)} className="mt-0.5" aria-required />
            <span>{t('auth.agreeAge', { age: settings.min_age })}</span>
          </label>
        </div>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button type="submit" className="w-full h-11 bg-rose-600 hover:bg-rose-700" disabled={busy || !agreeTerms || !agreeAge}>
          {busy ? t('auth.registering') : t('auth.registerButton')}
        </Button>
        <p className="text-sm text-center text-gray-600">
          {t('auth.hasAccount')} <Link to="/app/login" className="text-rose-600 underline">{t('auth.login')}</Link>
        </p>
      </form>
    </AuthCard>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const { requestPasswordReset } = useSupabaseAuth();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthCard title={t('auth.resetTitle')} description={t('auth.resetLead')}>
      {done ? (
        <p className="text-sm text-gray-700 text-center">{t('auth.resetSent')}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input type="email" required placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <Button type="submit" className="w-full h-11">{t('common.send')}</Button>
        </form>
      )}
      <p className="text-sm text-center mt-4">
        <Link to="/app/login" className="underline text-gray-600">{t('auth.backToLogin')}</Link>
      </p>
    </AuthCard>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword, session } = useSupabaseAuth();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await updatePassword(password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthCard title={t('auth.newPasswordTitle')}>
      {!session ? (
        <p className="text-sm text-gray-700 text-center">{t('auth.linkInvalid')}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input type="password" required minLength={8} placeholder={t('auth.newPassword')} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <Button type="submit" className="w-full h-11">{t('auth.change')}</Button>
        </form>
      )}
    </AuthCard>
  );
};
