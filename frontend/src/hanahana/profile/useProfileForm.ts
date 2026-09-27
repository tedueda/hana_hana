import { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { loadMasterData, type MasterData } from '../api/master';
import {
  fetchProfileDetails,
  replaceMyInterests,
  replaceMyLanguages,
  replaceMyPurposes,
  updateMyProfile,
  type LanguageInput,
} from '../api/profile';
import type { Country, Gender, LanguageLevel, MeetingPref, Nationality, ProfilePhoto } from '../types';

export interface ProfileFormState {
  nickname: string;
  gender: Gender | null;
  birthdate: string;
  nationality: Nationality | null;
  country: Country | null;
  regionId: string;
  occupation: string;
  bio: string;
  meetingPref: MeetingPref | null;
  prefGender: Gender[];
  prefNationality: Nationality[];
  prefAgeMin: string;
  prefAgeMax: string;
  nativeLang: string;
  learning: { code: string; level: LanguageLevel }[];
  interestIds: string[];
  purposeIds: string[];
  photos: ProfilePhoto[];
}

const EMPTY: ProfileFormState = {
  nickname: '',
  gender: null,
  birthdate: '',
  nationality: null,
  country: null,
  regionId: '',
  occupation: '',
  bio: '',
  meetingPref: null,
  prefGender: [],
  prefNationality: [],
  prefAgeMin: '',
  prefAgeMax: '',
  nativeLang: '',
  learning: [],
  interestIds: [],
  purposeIds: [],
  photos: [],
};

export type ProfileSection = 'basic' | 'partner' | 'purpose' | 'language' | 'interest' | 'photo' | 'bio';

export function ageFromBirthdate(birthdate: string): number | null {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export function isBasicComplete(f: ProfileFormState): boolean {
  return f.nickname.trim().length > 0 && !!f.gender && !!f.birthdate && !!f.nationality && !!f.country;
}

export function isProfileComplete(f: ProfileFormState, photoRequired: boolean): boolean {
  return isBasicComplete(f) && !!f.nativeLang && f.purposeIds.length > 0 && (!photoRequired || f.photos.length > 0);
}

export function useProfileForm() {
  const { user, profile } = useSupabaseAuth();
  const [master, setMaster] = useState<MasterData | null>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);

  useEffect(() => {
    loadMasterData().then(setMaster).catch(setLoadError);
  }, []);

  useEffect(() => {
    if (!profile || !user || loaded) return;
    fetchProfileDetails(user.id)
      .then((d) => {
        setForm({
          nickname: profile.nickname ?? '',
          gender: profile.gender,
          birthdate: profile.birthdate ?? '',
          nationality: profile.nationality,
          country: profile.residence_country,
          regionId: profile.residence_region_id ?? '',
          occupation: profile.occupation ?? '',
          bio: profile.bio ?? '',
          meetingPref: profile.meeting_pref,
          prefGender: profile.pref_gender ?? [],
          prefNationality: profile.pref_nationality ?? [],
          prefAgeMin: profile.pref_age_min?.toString() ?? '',
          prefAgeMax: profile.pref_age_max?.toString() ?? '',
          nativeLang: d.languages.find((l) => l.role === 'native')?.language_code ?? '',
          learning: d.languages.filter((l) => l.role === 'learning').map((l) => ({ code: l.language_code, level: l.level })),
          interestIds: d.interestIds,
          purposeIds: d.purposeIds,
          photos: d.photos,
        });
        setLoaded(true);
      })
      .catch(setLoadError);
  }, [profile, user, loaded]);

  const patch = useCallback((p: Partial<ProfileFormState>) => setForm((f) => ({ ...f, ...p })), []);

  /** 指定セクションの内容をサーバーへ保存 (「進むと保存」) */
  const saveSections = useCallback(
    async (sections: ProfileSection[], extra: { onboarding_completed?: boolean; onboarding_step?: number } = {}) => {
      if (!user) return;
      const f = form;
      const jobs: Promise<void>[] = [];
      if (sections.includes('language')) {
        const languages: LanguageInput[] = [];
        if (f.nativeLang) languages.push({ language_code: f.nativeLang, role: 'native', level: 'native' });
        for (const l of f.learning) if (l.code !== f.nativeLang) languages.push({ language_code: l.code, role: 'learning', level: l.level });
        jobs.push(replaceMyLanguages(user.id, languages));
      }
      if (sections.includes('interest')) jobs.push(replaceMyInterests(user.id, f.interestIds));
      if (sections.includes('purpose')) jobs.push(replaceMyPurposes(user.id, f.purposeIds));
      await Promise.all(jobs);

      const p: Parameters<typeof updateMyProfile>[1] = { ...extra };
      if (sections.includes('basic')) {
        Object.assign(p, {
          nickname: f.nickname.trim(),
          gender: f.gender,
          birthdate: f.birthdate || null,
          nationality: f.nationality,
          residence_country: f.country,
          residence_region_id: f.regionId || null,
          occupation: f.occupation.trim() || null,
        });
      }
      if (sections.includes('partner')) {
        Object.assign(p, {
          meeting_pref: f.meetingPref,
          pref_gender: f.prefGender.length ? f.prefGender : null,
          pref_nationality: f.prefNationality.length ? f.prefNationality : null,
          pref_age_min: f.prefAgeMin ? Number(f.prefAgeMin) : null,
          pref_age_max: f.prefAgeMax ? Number(f.prefAgeMax) : null,
        });
      }
      if (sections.includes('bio')) Object.assign(p, { bio: f.bio.trim() || null });
      if (Object.keys(p).length) await updateMyProfile(user.id, p);
    },
    [user, form],
  );

  return { user, profile, master, form, patch, loaded: loaded && !!master, loadError, saveSections };
}
