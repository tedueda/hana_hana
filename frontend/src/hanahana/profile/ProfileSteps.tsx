import React, { useMemo, useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useI18n } from '../i18n';
import { useErrorMessage, useLabels } from '../hooks';
import { localizedName, type MasterData } from '../api/master';
import { deleteProfilePhoto, setPrimaryPhoto, uploadProfilePhoto } from '../api/profile';
import { Avatar } from '../components/ProfileCard';
import { GENDERS, LEVELS, MEETING_PREFS, NATIONALITIES } from '../labels';
import type { ProfilePhoto, UiLang } from '../types';
import type { ProfileFormState } from './useProfileForm';

export interface StepProps {
  form: ProfileFormState;
  patch: (p: Partial<ProfileFormState>) => void;
  master: MasterData;
  minAge: number;
}

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'px-3 py-2 rounded-full text-sm border transition-colors min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400',
      active ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-rose-300',
    )}
  >
    {children}
  </button>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string }> = ({ label, required, children, hint }) => {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {label}
        {required && <span className="text-[10px] text-rose-600 border border-rose-200 rounded px-1">{t('common.required')}</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
};

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function maxBirthdate(minAge: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - minAge);
  return d.toISOString().slice(0, 10);
}

export const BasicStep: React.FC<StepProps> = ({ form, patch, master, minAge }) => {
  const { t, lang } = useI18n();
  const L = useLabels();
  const regions = useMemo(() => master.regions.filter((r) => !form.country || r.country === form.country), [master, form.country]);
  const uiLang = lang as UiLang;
  return (
    <div className="space-y-4">
      <Field label={t('form.nickname')} required>
        <Input value={form.nickname} maxLength={20} autoComplete="nickname" onChange={(e) => patch({ nickname: e.target.value })} />
      </Field>
      <Field label={t('form.gender')} required>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => <Chip key={g} active={form.gender === g} onClick={() => patch({ gender: g })}>{L.gender[g]}</Chip>)}
        </div>
      </Field>
      <Field label={t('form.birthdate')} required hint={t('onboarding.lead.basic')}>
        <Input type="date" value={form.birthdate} max={maxBirthdate(minAge)} onChange={(e) => patch({ birthdate: e.target.value })} />
      </Field>
      <Field label={t('form.nationality')} required>
        <div className="flex gap-2">
          {NATIONALITIES.map((n) => <Chip key={n} active={form.nationality === n} onClick={() => patch({ nationality: n })}>{L.nationality[n]}</Chip>)}
        </div>
      </Field>
      <Field label={t('form.country')} required>
        <div className="flex gap-2">
          {NATIONALITIES.map((c) => (
            <Chip key={c} active={form.country === c} onClick={() => patch({ country: c, regionId: '' })}>{L.country[c]}</Chip>
          ))}
        </div>
      </Field>
      {form.country && form.country !== 'other' && (
        <Field label={t('form.region')}>
          <select
            className="w-full h-11 rounded-md border border-gray-300 px-2 text-sm bg-white"
            value={form.regionId}
            onChange={(e) => patch({ regionId: e.target.value })}
          >
            <option value="">{t('form.selectPlaceholder')}</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{localizedName(r, uiLang)}</option>)}
          </select>
        </Field>
      )}
      <Field label={t('form.occupation')}>
        <Input value={form.occupation} maxLength={50} onChange={(e) => patch({ occupation: e.target.value })} />
      </Field>
    </div>
  );
};

export const PartnerStep: React.FC<StepProps> = ({ form, patch, minAge }) => {
  const { t } = useI18n();
  const L = useLabels();
  return (
    <div className="space-y-4">
      <Field label={t('form.prefNationality')}>
        <div className="flex flex-wrap gap-2">
          <Chip active={form.prefNationality.length === 0} onClick={() => patch({ prefNationality: [] })}>{t('form.noPreference')}</Chip>
          {NATIONALITIES.map((n) => (
            <Chip key={n} active={form.prefNationality.includes(n)} onClick={() => patch({ prefNationality: toggle(form.prefNationality, n) })}>{L.nationality[n]}</Chip>
          ))}
        </div>
      </Field>
      <Field label={t('form.prefGender')}>
        <div className="flex flex-wrap gap-2">
          <Chip active={form.prefGender.length === 0} onClick={() => patch({ prefGender: [] })}>{t('form.noPreference')}</Chip>
          {GENDERS.filter((g) => g !== 'undisclosed').map((g) => (
            <Chip key={g} active={form.prefGender.includes(g)} onClick={() => patch({ prefGender: toggle(form.prefGender, g) })}>{L.gender[g]}</Chip>
          ))}
        </div>
      </Field>
      <Field label={t('form.prefAge')}>
        <div className="flex items-center gap-2">
          <Input type="number" inputMode="numeric" min={minAge} max={99} className="w-24 h-11" value={form.prefAgeMin} placeholder={String(minAge)} onChange={(e) => patch({ prefAgeMin: e.target.value })} />
          <span className="text-gray-500">〜</span>
          <Input type="number" inputMode="numeric" min={minAge} max={99} className="w-24 h-11" value={form.prefAgeMax} placeholder="99" onChange={(e) => patch({ prefAgeMax: e.target.value })} />
        </div>
      </Field>
      <Field label={t('form.meetingPref')}>
        <div className="flex flex-wrap gap-2">
          {MEETING_PREFS.map((m) => <Chip key={m} active={form.meetingPref === m} onClick={() => patch({ meetingPref: m })}>{L.meetingPref[m]}</Chip>)}
        </div>
      </Field>
    </div>
  );
};

export const PurposeStep: React.FC<StepProps> = ({ form, patch, master }) => {
  const { lang } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      {master.purposes.map((p) => (
        <Chip key={p.id} active={form.purposeIds.includes(p.id)} onClick={() => patch({ purposeIds: toggle(form.purposeIds, p.id) })}>
          {localizedName(p, lang as UiLang)}
        </Chip>
      ))}
    </div>
  );
};

export const LanguageStep: React.FC<StepProps> = ({ form, patch, master }) => {
  const { t, lang } = useI18n();
  const L = useLabels();
  const uiLang = lang as UiLang;
  return (
    <div className="space-y-4">
      <Field label={t('form.nativeLang')} required>
        <div className="flex flex-wrap gap-2">
          {master.languages.map((l) => (
            <Chip key={l.code} active={form.nativeLang === l.code} onClick={() => patch({ nativeLang: l.code, learning: form.learning.filter((x) => x.code !== l.code) })}>
              {localizedName(l, uiLang)}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label={t('form.learningLang')}>
        <div className="space-y-2">
          {master.languages.filter((l) => l.code !== form.nativeLang).map((l) => {
            const cur = form.learning.find((x) => x.code === l.code);
            return (
              <div key={l.code} className="flex items-center gap-2 flex-wrap">
                <Chip
                  active={Boolean(cur)}
                  onClick={() => patch({ learning: cur ? form.learning.filter((x) => x.code !== l.code) : [...form.learning, { code: l.code, level: 'beginner' }] })}
                >
                  {localizedName(l, uiLang)}
                </Chip>
                {cur && LEVELS.map((lv) => (
                  <Chip key={lv} active={cur.level === lv} onClick={() => patch({ learning: form.learning.map((x) => (x.code === l.code ? { ...x, level: lv } : x)) })}>
                    {L.level[lv]}
                  </Chip>
                ))}
              </div>
            );
          })}
        </div>
      </Field>
    </div>
  );
};

export const InterestStep: React.FC<StepProps> = ({ form, patch, master }) => {
  const { lang } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      {master.interests.map((i) => (
        <Chip key={i.id} active={form.interestIds.includes(i.id)} onClick={() => patch({ interestIds: toggle(form.interestIds, i.id) })}>
          {localizedName(i, lang as UiLang)}
        </Chip>
      ))}
    </div>
  );
};

export const PhotoStep: React.FC<StepProps & { userId: string }> = ({ form, patch, userId }) => {
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const photos = [...form.photos].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!PHOTO_TYPES.includes(file.type)) return setError(t('form.photoType'));
    if (file.size > MAX_PHOTO_BYTES) return setError(t('form.photoSize'));
    const used = new Set(form.photos.map((p) => p.sort_order));
    const slot = [0, 1, 2, 3, 4].find((i) => !used.has(i));
    if (slot === undefined) return setError(t('form.photoLimit', { n: MAX_PHOTOS }));
    setBusy(true);
    try {
      const p = await uploadProfilePhoto(userId, file, slot, form.photos.length === 0);
      patch({ photos: [...form.photos, p] });
    } catch (e) {
      setError(`${t('form.photoUploadFailed')} (${errMsg(e)})`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: ProfilePhoto) => {
    setError('');
    try {
      await deleteProfilePhoto(p);
      let rest = form.photos.filter((x) => x.id !== p.id);
      if (p.is_primary && rest.length) {
        await setPrimaryPhoto(userId, rest[0].id);
        rest = rest.map((x, i) => ({ ...x, is_primary: i === 0 }));
      }
      patch({ photos: rest });
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const makePrimary = async (p: ProfilePhoto) => {
    setError('');
    try {
      await setPrimaryPhoto(userId, p.id);
      patch({ photos: form.photos.map((x) => ({ ...x, is_primary: x.id === p.id })) });
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <div key={p.id} className={cn('relative rounded-xl overflow-hidden border-2', p.is_primary ? 'border-rose-500' : 'border-transparent')}>
            <Avatar path={p.storage_path} name={form.nickname} className="aspect-[4/5]" />
            {p.is_primary ? (
              <span className="absolute bottom-1 left-1 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded">{t('form.mainPhoto')}</span>
            ) : (
              <button type="button" onClick={() => makePrimary(p)} aria-label={t('form.setMain')} className="absolute bottom-1 left-1 bg-black/60 text-white rounded-full p-1.5">
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
            <button type="button" onClick={() => remove(p)} aria-label={t('form.deletePhoto')} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {form.photos.length < MAX_PHOTOS && (
          <label className="aspect-[4/5] rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-sm text-gray-500 cursor-pointer hover:border-rose-300">
            {busy ? t('common.saving') : t('form.addPhoto')}
            <input type="file" accept={PHOTO_TYPES.join(',')} className="hidden" disabled={busy} onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-500">{t('form.photoType')} / {t('form.photoSize')}</p>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
};

export const BioStep: React.FC<StepProps> = ({ form, patch }) => {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5">
      <Textarea value={form.bio} rows={6} maxLength={1000} onChange={(e) => patch({ bio: e.target.value })} />
      <p className="text-xs text-gray-500 text-right">{t('form.bioCount', { n: form.bio.length })}</p>
    </div>
  );
};
