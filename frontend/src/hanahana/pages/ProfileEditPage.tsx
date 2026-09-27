import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { loadMasterData, localizedName, type MasterData } from '../api/master';
import {
  deleteProfilePhoto,
  fetchProfileDetails,
  replaceMyInterests,
  replaceMyLanguages,
  replaceMyPurposes,
  updateMyProfile,
  uploadProfilePhoto,
  type LanguageInput,
} from '../api/profile';
import { Avatar } from '../components/ProfileCard';
import { GENDERS, GENDER_LABELS, LEVELS, LEVEL_LABELS, MEETING_PREFS, MEETING_PREF_LABELS, NATIONALITIES, NATIONALITY_LABELS, errorMessage } from '../labels';
import type { Country, Gender, LanguageLevel, MeetingPref, Nationality, ProfilePhoto, UiLang } from '../types';

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'px-3 py-1.5 rounded-full text-sm border transition-colors',
      active ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-rose-300',
    )}
  >
    {children}
  </button>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
    <h2 className="font-semibold text-gray-900">{title}</h2>
    {children}
  </section>
);

const ProfileEditPage: React.FC<{ onboarding?: boolean }> = ({ onboarding = false }) => {
  const { user, profile, refreshProfile } = useSupabaseAuth();
  const navigate = useNavigate();
  const [master, setMaster] = useState<MasterData | null>(null);
  const uiLang = (profile?.preferred_ui_lang ?? 'ja') as UiLang;

  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthdate, setBirthdate] = useState('');
  const [nationality, setNationality] = useState<Nationality | null>(null);
  const [country, setCountry] = useState<Country | null>(null);
  const [regionId, setRegionId] = useState<string>('');
  const [occupation, setOccupation] = useState('');
  const [bio, setBio] = useState('');
  const [meetingPref, setMeetingPref] = useState<MeetingPref | null>(null);
  const [prefGender, setPrefGender] = useState<Gender[]>([]);
  const [prefNationality, setPrefNationality] = useState<Nationality[]>([]);
  const [prefAgeMin, setPrefAgeMin] = useState('');
  const [prefAgeMax, setPrefAgeMax] = useState('');
  const [nativeLang, setNativeLang] = useState('');
  const [learning, setLearning] = useState<{ code: string; level: LanguageLevel }[]>([]);
  const [interestIds, setInterestIds] = useState<string[]>([]);
  const [purposeIds, setPurposeIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMasterData().then(setMaster).catch((e) => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (!profile || !user) return;
    setNickname(profile.nickname ?? '');
    setGender(profile.gender);
    setBirthdate(profile.birthdate ?? '');
    setNationality(profile.nationality);
    setCountry(profile.residence_country);
    setRegionId(profile.residence_region_id ?? '');
    setOccupation(profile.occupation ?? '');
    setBio(profile.bio ?? '');
    setMeetingPref(profile.meeting_pref);
    setPrefGender(profile.pref_gender ?? []);
    setPrefNationality(profile.pref_nationality ?? []);
    setPrefAgeMin(profile.pref_age_min?.toString() ?? '');
    setPrefAgeMax(profile.pref_age_max?.toString() ?? '');
    fetchProfileDetails(user.id)
      .then((d) => {
        setNativeLang(d.languages.find((l) => l.role === 'native')?.language_code ?? '');
        setLearning(d.languages.filter((l) => l.role === 'learning').map((l) => ({ code: l.language_code, level: l.level })));
        setInterestIds(d.interestIds);
        setPurposeIds(d.purposeIds);
        setPhotos(d.photos);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [profile, user]);

  const regions = useMemo(() => (master?.regions ?? []).filter((r) => !country || r.country === country), [master, country]);

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const isComplete =
    nickname.trim().length > 0 && gender && birthdate && nationality && country && nativeLang && purposeIds.length > 0;

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const languages: LanguageInput[] = [];
      if (nativeLang) languages.push({ language_code: nativeLang, role: 'native', level: 'native' });
      for (const l of learning) if (l.code !== nativeLang) languages.push({ language_code: l.code, role: 'learning', level: l.level });

      await Promise.all([
        replaceMyLanguages(user.id, languages),
        replaceMyInterests(user.id, interestIds),
        replaceMyPurposes(user.id, purposeIds),
      ]);
      await updateMyProfile(user.id, {
        nickname: nickname.trim(),
        gender,
        birthdate: birthdate || null,
        nationality,
        residence_country: country,
        residence_region_id: regionId || null,
        occupation: occupation.trim() || null,
        bio: bio.trim() || null,
        meeting_pref: meetingPref,
        pref_gender: prefGender.length ? prefGender : null,
        pref_nationality: prefNationality.length ? prefNationality : null,
        pref_age_min: prefAgeMin ? Number(prefAgeMin) : null,
        pref_age_max: prefAgeMax ? Number(prefAgeMax) : null,
        onboarding_completed: Boolean(isComplete),
      });
      await refreshProfile();
      navigate(onboarding ? '/app' : '/app/profile', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file || !user) return;
    setError('');
    try {
      const used = new Set(photos.map((p) => p.sort_order));
      const slot = [0, 1, 2, 3, 4].find((i) => !used.has(i));
      if (slot === undefined) throw new Error('写真は5枚までです');
      const p = await uploadProfilePhoto(user.id, file, slot, photos.length === 0);
      setPhotos((prev) => [...prev, p]);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const removePhoto = async (p: ProfilePhoto) => {
    await deleteProfilePhoto(p);
    setPhotos((prev) => prev.filter((x) => x.id !== p.id));
  };

  if (!master) return <p className="text-center text-gray-500 py-10">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{onboarding ? 'プロフィールを作成' : 'プロフィール編集'}</h1>
      {onboarding && <p className="text-sm text-gray-600">おすすめ表示のために、基本情報・言語・利用目的を入力してください。</p>}

      <Section title="写真">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-xl overflow-hidden">
              <Avatar path={p.storage_path} name={nickname} className="aspect-square" />
              <button type="button" onClick={() => removePhoto(p)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {photos.length < 5 && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-sm text-gray-500 cursor-pointer hover:border-rose-300">
              ＋追加
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          )}
        </div>
      </Section>

      <Section title="基本情報">
        <div className="space-y-1.5">
          <Label>ニックネーム *</Label>
          <Input value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>性別 *</Label>
          <div className="flex flex-wrap gap-2">{GENDERS.map((g) => <Chip key={g} active={gender === g} onClick={() => setGender(g)}>{GENDER_LABELS[g]}</Chip>)}</div>
        </div>
        <div className="space-y-1.5">
          <Label>生年月日 *（年齢のみ表示されます）</Label>
          <Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>国籍 *</Label>
          <div className="flex gap-2">{NATIONALITIES.map((n) => <Chip key={n} active={nationality === n} onClick={() => setNationality(n)}>{NATIONALITY_LABELS[n]}</Chip>)}</div>
        </div>
        <div className="space-y-1.5">
          <Label>居住国 *</Label>
          <div className="flex gap-2">
            {NATIONALITIES.map((c) => (
              <Chip key={c} active={country === c} onClick={() => { setCountry(c); setRegionId(''); }}>{NATIONALITY_LABELS[c]}</Chip>
            ))}
          </div>
        </div>
        {country && country !== 'other' && (
          <div className="space-y-1.5">
            <Label>居住地域</Label>
            <select className="w-full h-9 rounded-md border border-gray-300 px-2 text-sm bg-white" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              <option value="">選択してください</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{localizedName(r, uiLang)}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>職業</Label>
          <Input value={occupation} maxLength={50} onChange={(e) => setOccupation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>自己紹介</Label>
          <Textarea value={bio} rows={4} maxLength={1000} onChange={(e) => setBio(e.target.value)} />
        </div>
      </Section>

      <Section title="言語">
        <div className="space-y-1.5">
          <Label>母語 *</Label>
          <div className="flex gap-2">
            {master.languages.map((l) => <Chip key={l.code} active={nativeLang === l.code} onClick={() => setNativeLang(l.code)}>{localizedName(l, uiLang)}</Chip>)}
          </div>
        </div>
        <div className="space-y-2">
          <Label>学習中の言語とレベル</Label>
          {master.languages.filter((l) => l.code !== nativeLang).map((l) => {
            const cur = learning.find((x) => x.code === l.code);
            return (
              <div key={l.code} className="flex items-center gap-2 flex-wrap">
                <Chip active={Boolean(cur)} onClick={() => setLearning((prev) => (cur ? prev.filter((x) => x.code !== l.code) : [...prev, { code: l.code, level: 'beginner' }]))}>
                  {localizedName(l, uiLang)}
                </Chip>
                {cur && LEVELS.map((lv) => (
                  <Chip key={lv} active={cur.level === lv} onClick={() => setLearning((prev) => prev.map((x) => (x.code === l.code ? { ...x, level: lv } : x)))}>
                    {LEVEL_LABELS[lv]}
                  </Chip>
                ))}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="利用目的 *">
        <div className="flex flex-wrap gap-2">
          {master.purposes.map((p) => <Chip key={p.id} active={purposeIds.includes(p.id)} onClick={() => setPurposeIds((prev) => toggle(prev, p.id))}>{localizedName(p, uiLang)}</Chip>)}
        </div>
      </Section>

      <Section title="趣味・興味">
        <div className="flex flex-wrap gap-2">
          {master.interests.map((i) => <Chip key={i.id} active={interestIds.includes(i.id)} onClick={() => setInterestIds((prev) => toggle(prev, i.id))}>{localizedName(i, uiLang)}</Chip>)}
        </div>
      </Section>

      <Section title="交流スタイル・希望条件">
        <div className="space-y-1.5">
          <Label>交流の希望</Label>
          <div className="flex flex-wrap gap-2">{MEETING_PREFS.map((m) => <Chip key={m} active={meetingPref === m} onClick={() => setMeetingPref(m)}>{MEETING_PREF_LABELS[m]}</Chip>)}</div>
        </div>
        <div className="space-y-1.5">
          <Label>相手の性別（複数可）</Label>
          <div className="flex flex-wrap gap-2">{GENDERS.filter((g) => g !== 'undisclosed').map((g) => <Chip key={g} active={prefGender.includes(g)} onClick={() => setPrefGender((p) => toggle(p, g))}>{GENDER_LABELS[g]}</Chip>)}</div>
        </div>
        <div className="space-y-1.5">
          <Label>相手の国籍（複数可）</Label>
          <div className="flex gap-2">{NATIONALITIES.map((n) => <Chip key={n} active={prefNationality.includes(n)} onClick={() => setPrefNationality((p) => toggle(p, n))}>{NATIONALITY_LABELS[n]}</Chip>)}</div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="shrink-0">相手の年齢</Label>
          <Input type="number" min={18} max={99} className="w-20" value={prefAgeMin} onChange={(e) => setPrefAgeMin(e.target.value)} />
          <span>〜</span>
          <Input type="number" min={18} max={99} className="w-20" value={prefAgeMax} onChange={(e) => setPrefAgeMax(e.target.value)} />
        </div>
      </Section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="sticky bottom-20 md:bottom-4">
        <Button onClick={save} disabled={saving || !isComplete} className="w-full bg-rose-600 hover:bg-rose-700 shadow-lg">
          {saving ? '保存中…' : onboarding ? 'はじめる' : '保存する'}
        </Button>
        {!isComplete && <p className="text-xs text-gray-500 text-center mt-1">* の項目を入力してください</p>}
      </div>
    </div>
  );
};

export default ProfileEditPage;
