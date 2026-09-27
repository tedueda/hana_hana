import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { useI18n } from '../i18n';
import { useErrorMessage } from '../hooks';
import LangSwitch from '../components/LangSwitch';
import { DEFAULT_PUBLIC_SETTINGS, fetchConsentStatus, fetchPublicSettings, recordConsent, type ConsentKind, type PublicSettings } from '../api/settings';
import { fetchMyVerification, updateMyProfile } from '../api/profile';
import { ageFromBirthdate, isBasicComplete, isProfileComplete, useProfileForm, type ProfileSection } from '../profile/useProfileForm';
import { BasicStep, BioStep, InterestStep, LanguageStep, PartnerStep, PhotoStep, PurposeStep } from '../profile/ProfileSteps';

const STEPS: ProfileSection[] = ['basic', 'partner', 'purpose', 'language', 'interest', 'photo', 'bio'];
const TOTAL = STEPS.length + 1; // + done
const CONSENT_KINDS: ConsentKind[] = ['terms', 'privacy', 'age'];

const ConsentGate: React.FC<{ settings: PublicSettings; onDone: () => void }> = ({ settings, onDone }) => {
  const { t, lang } = useI18n();
  const errMsg = useErrorMessage();
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!terms || !age) return setError(t('auth.consentRequired'));
    setBusy(true);
    setError('');
    try {
      await recordConsent(CONSENT_KINDS, lang);
      onDone();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">{t('auth.uiLang')}</p>
        <LangSwitch />
      </div>
      <label className="flex items-start gap-3 min-h-[44px]">
        <input type="checkbox" className="mt-1 w-5 h-5 accent-rose-600" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span className="text-sm">
          {t('auth.agreeTerms')}{' '}
          <Link to="/app/terms" target="_blank" className="text-rose-600 underline">{t('legal.terms')}</Link>
          {' / '}
          <Link to="/app/privacy" target="_blank" className="text-rose-600 underline">{t('legal.privacy')}</Link>
        </span>
      </label>
      <label className="flex items-start gap-3 min-h-[44px]">
        <input type="checkbox" className="mt-1 w-5 h-5 accent-rose-600" checked={age} onChange={(e) => setAge(e.target.checked)} />
        <span className="text-sm">{t('auth.agreeAge', { age: settings.min_age })}</span>
      </label>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <Button className="w-full h-12 bg-rose-600 hover:bg-rose-700" disabled={busy} onClick={submit}>
        {busy ? t('common.saving') : t('common.next')}
      </Button>
    </div>
  );
};

const StateRow: React.FC<{ label: string; state: 'complete' | 'incomplete' | 'pending' }> = ({ label, state }) => {
  const { t } = useI18n();
  const Icon = state === 'complete' ? CheckCircle2 : state === 'pending' ? Clock : Circle;
  const color = state === 'complete' ? 'text-emerald-600' : state === 'pending' ? 'text-amber-600' : 'text-gray-400';
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <span className={`flex items-center gap-1 text-sm ${color}`}>
        <Icon className="w-4 h-4" />
        {t(`onboarding.done.${state}`)}
      </span>
    </div>
  );
};

const OnboardingPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const errMsg = useErrorMessage();
  const { refreshProfile } = useSupabaseAuth();
  const { user, profile, master, form, patch, loaded, loadError, saveSections } = useProfileForm();
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [consented, setConsented] = useState<boolean | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [resumed, setResumed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verifStatus, setVerifStatus] = useState<string>('unverified');

  useEffect(() => {
    fetchPublicSettings().then(setSettings).catch(() => undefined);
    fetchConsentStatus()
      .then((rows) => setConsented(CONSENT_KINDS.every((k) => rows.some((r) => r.kind === k && r.is_current))))
      .catch(() => setConsented(false));
  }, []);

  useEffect(() => {
    if (!profile || step !== null) return;
    const saved = Math.min(Math.max(profile.onboarding_step ?? 0, 0), STEPS.length);
    setStep(saved);
    setResumed(saved > 0 && !profile.onboarding_completed);
  }, [profile, step]);

  useEffect(() => {
    if (step === STEPS.length) fetchMyVerification().then((v) => setVerifStatus(v?.status ?? 'unverified')).catch(() => undefined);
  }, [step]);

  const section = step !== null && step < STEPS.length ? STEPS[step] : null;

  const validation = useMemo((): string | null => {
    if (!section) return null;
    if (section === 'basic') {
      if (!isBasicComplete(form)) return t('onboarding.missing');
      const age = ageFromBirthdate(form.birthdate);
      if (age === null || new Date(form.birthdate) > new Date()) return t('onboarding.futureDate');
      if (age < settings.min_age) return t('onboarding.ageError', { age: settings.min_age });
      if (form.prefAgeMin && form.prefAgeMax && Number(form.prefAgeMin) > Number(form.prefAgeMax)) return t('onboarding.missing');
    }
    if (section === 'purpose' && form.purposeIds.length === 0) return t('onboarding.missing');
    if (section === 'language' && !form.nativeLang) return t('onboarding.missing');
    if (section === 'photo' && settings.photo_required && form.photos.length === 0) return t('onboarding.missing');
    return null;
  }, [section, form, settings, t]);

  useEffect(() => {
    if (!validation) setError('');
  }, [validation]);

  const optional = section === 'partner' || section === 'interest' || section === 'bio' || (section === 'photo' && !settings.photo_required);

  const advance = async (save: boolean) => {
    if (!user || step === null || !section) return;
    if (save && validation) return setError(validation);
    setBusy(true);
    setError('');
    try {
      const next = step + 1;
      const finishing = next === STEPS.length;
      if (finishing && !isProfileComplete(form, settings.photo_required)) {
        setStep(0);
        return setError(t('onboarding.missing'));
      }
      await saveSections([section], { onboarding_step: next, ...(finishing ? { onboarding_completed: true } : {}) });
      setStep(next);
      setResumed(false);
      if (finishing) await refreshProfile();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const back = async () => {
    if (!user || step === null || step === 0) return;
    const prev = step - 1;
    setStep(prev);
    setError('');
    updateMyProfile(user.id, { onboarding_step: prev }).catch(() => undefined);
  };

  if (loadError) return <div className="p-6 text-center text-red-600">{errMsg(loadError)}</div>;
  if (!loaded || !master || !user || step === null || consented === null) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">{t('common.loading')}</div>;
  }

  const stepProps = { form, patch, master, minAge: settings.min_age };
  const emailVerified = Boolean(user.email_confirmed_at);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-6 space-y-5 pb-28">
        <header className="space-y-2">
          <h1 className="text-xl font-bold">{t('onboarding.title')}</h1>
          {consented && (
            <>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{t('onboarding.progress', { step: step + 1, total: TOTAL })}</span>
                <span className="font-medium text-gray-700">{t(`onboarding.step.${section ?? 'done'}`)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={step + 1}>
                <div className="h-full bg-rose-500 transition-all" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
              </div>
            </>
          )}
        </header>

        {!consented ? (
          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <ConsentGate settings={settings} onDone={() => setConsented(true)} />
          </section>
        ) : section ? (
          <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
            {resumed && step > 0 && <p className="text-xs bg-rose-50 text-rose-700 rounded-lg px-3 py-2">{t('onboarding.resume')}</p>}
            <p className="text-sm text-gray-600">{t(`onboarding.lead.${section}`)}</p>
            {section === 'basic' && <BasicStep {...stepProps} />}
            {section === 'partner' && <PartnerStep {...stepProps} />}
            {section === 'purpose' && <PurposeStep {...stepProps} />}
            {section === 'language' && <LanguageStep {...stepProps} />}
            {section === 'interest' && <InterestStep {...stepProps} />}
            {section === 'photo' && <PhotoStep {...stepProps} userId={user.id} />}
            {section === 'bio' && <BioStep {...stepProps} />}
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </section>
        ) : (
          <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 text-center">
            <h2 className="text-lg font-bold">{t('onboarding.done.title')}</h2>
            <p className="text-sm text-gray-600">{t('onboarding.done.lead')}</p>
            <div className="text-left divide-y divide-gray-100 border-t border-b border-gray-100">
              <StateRow label={t('onboarding.done.stateEmail')} state={emailVerified ? 'complete' : 'incomplete'} />
              <StateRow label={t('onboarding.done.stateProfile')} state="complete" />
              <StateRow label={t('onboarding.done.stateVerify')} state={verifStatus === 'verified' ? 'complete' : verifStatus === 'pending' ? 'pending' : 'incomplete'} />
            </div>
            {settings.photo_required && form.photos.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-left">{t('publish.noPhotoHidden')}</p>
            )}
            <Button className="w-full h-12 bg-rose-600 hover:bg-rose-700" onClick={() => navigate('/app', { replace: true })}>{t('onboarding.finish')}</Button>
            <Link to="/app/profile/verification" className="block text-sm text-rose-600 underline">{t('verification.title')}</Link>
          </section>
        )}
      </div>

      {consented && section && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-md mx-auto px-4 py-3 flex gap-2">
            <Button variant="outline" className="h-12 flex-1" disabled={busy || step === 0} onClick={back}>{t('common.back')}</Button>
            {optional && (
              <Button variant="ghost" className="h-12 flex-1" disabled={busy} onClick={() => advance(false)}>{t('onboarding.skip')}</Button>
            )}
            <Button className="h-12 flex-[2] bg-rose-600 hover:bg-rose-700" disabled={busy} onClick={() => advance(true)}>
              {busy ? t('common.saving') : t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingPage;
