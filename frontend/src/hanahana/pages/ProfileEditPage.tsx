import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { useI18n } from '../i18n';
import { useErrorMessage } from '../hooks';
import { DEFAULT_PUBLIC_SETTINGS, fetchPublicSettings, type PublicSettings } from '../api/settings';
import { PageHeader } from './SettingsPage';
import { ageFromBirthdate, isBasicComplete, isProfileComplete, useProfileForm, type ProfileSection } from '../profile/useProfileForm';
import ProfileAiAssist from '../components/ProfileAiAssist';
import { BasicStep, BioStep, InterestStep, LanguageStep, PartnerStep, PhotoStep, PurposeStep } from '../profile/ProfileSteps';

const SECTIONS: ProfileSection[] = ['photo', 'basic', 'partner', 'purpose', 'language', 'interest', 'bio'];

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
    <h2 className="font-semibold text-gray-900">{title}</h2>
    {children}
  </section>
);

const ProfileEditPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const errMsg = useErrorMessage();
  const { refreshProfile } = useSupabaseAuth();
  const { user, master, form, patch, loaded, loadError, saveSections } = useProfileForm();
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPublicSettings().then(setSettings).catch(() => undefined);
  }, []);

  const validation = useMemo((): string | null => {
    if (!isBasicComplete(form) || !form.nativeLang || form.purposeIds.length === 0) return t('onboarding.missing');
    const age = ageFromBirthdate(form.birthdate);
    if (age === null || new Date(form.birthdate) > new Date()) return t('onboarding.futureDate');
    if (age < settings.min_age) return t('onboarding.ageError', { age: settings.min_age });
    return null;
  }, [form, settings, t]);

  const save = async () => {
    if (!user) return;
    if (validation) return setError(validation);
    setSaving(true);
    setError('');
    try {
      await saveSections(SECTIONS, { onboarding_completed: isProfileComplete(form, settings.photo_required) });
      await refreshProfile();
      navigate('/app/profile', { replace: true });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <p className="text-center text-red-600 py-10">{errMsg(loadError)}</p>;
  if (!loaded || !master || !user) return <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>;

  const stepProps = { form, patch, master, minAge: settings.min_age };
  const body: Record<ProfileSection, React.ReactNode> = {
    photo: <PhotoStep {...stepProps} userId={user.id} />,
    basic: <BasicStep {...stepProps} />,
    partner: <PartnerStep {...stepProps} />,
    purpose: <PurposeStep {...stepProps} />,
    language: <LanguageStep {...stepProps} />,
    interest: <InterestStep {...stepProps} />,
    bio: (
      <div className="space-y-3">
        <BioStep {...stepProps} />
        <ProfileAiAssist bio={form.bio} onApply={(bio) => patch({ bio })} />
      </div>
    ),
  };

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title={t('form.editTitle')} back="/app/profile" />
      {settings.photo_required && form.photos.length === 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{t('publish.noPhotoHidden')}</p>
      )}
      {SECTIONS.map((s) => (
        <Section key={s} title={t(`onboarding.step.${s}`)}>{body[s]}</Section>
      ))}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 bg-white/95 border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-4 py-3">
          <Button className="w-full h-12 bg-rose-600 hover:bg-rose-700" disabled={saving} onClick={save}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditPage;
