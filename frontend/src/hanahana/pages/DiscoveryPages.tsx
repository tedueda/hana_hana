import React, { useEffect, useMemo, useState } from 'react';
import { Heart, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { useLikeAction, useRegionNames } from '../hooks';
import { fetchRecommendations, searchProfiles } from '../api/discovery';
import { loadMasterData, localizedName, type MasterData } from '../api/master';
import ProfileCard from '../components/ProfileCard';
import { GENDERS, GENDER_LABELS, LEVELS, LEVEL_LABELS, MEETING_PREFS, MEETING_PREF_LABELS, NATIONALITIES, NATIONALITY_LABELS, REASON_LABELS, errorMessage } from '../labels';
import type { PublicProfile, SearchFilters, UiLang } from '../types';

export const LikeButton: React.FC<{ profile: PublicProfile; liked: boolean; onLike: (p: PublicProfile) => void }> = ({ profile, liked, onLike }) => (
  <Button
    size="sm"
    variant={liked ? 'secondary' : 'default'}
    className={cn('w-full mt-1', !liked && 'bg-rose-600 hover:bg-rose-700')}
    disabled={liked}
    onClick={() => onLike(profile)}
  >
    <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
    {liked ? 'いいね済み' : 'いいね'}
  </Button>
);

export const RecommendPage: React.FC = () => {
  const { profile } = useSupabaseAuth();
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchRecommendations>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { liked, like } = useLikeAction();
  const regionName = useRegionNames();

  useEffect(() => {
    setLoading(true);
    fetchRecommendations(30)
      .then(setItems)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">おすすめ</h1>
        <p className="text-sm text-gray-500">{profile?.nickname ?? ''} さんの希望条件・言語・趣味から選びました</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-center text-gray-500 py-10">読み込み中…</p>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-500 py-10 space-y-2">
          <p>まだおすすめできるユーザーがいません。</p>
          <p className="text-sm">プロフィールの希望条件を広げると候補が増えます。</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((r) => (
            <ProfileCard
              key={r.id}
              profile={r.profile}
              regionName={regionName(r.profile.residence_region_id)}
              reasons={r.reasons.map((x) => REASON_LABELS[x] ?? x)}
              footer={<LikeButton profile={r.profile} liked={liked.has(r.id)} onLike={like} />}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} className={cn('px-3 py-1 rounded-full text-xs border', active ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-gray-300 text-gray-700')}>
    {children}
  </button>
);

export const SearchPage: React.FC = () => {
  const { profile } = useSupabaseAuth();
  const lang = (profile?.preferred_ui_lang ?? 'ja') as UiLang;
  const [master, setMaster] = useState<MasterData | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { liked, like } = useLikeAction();
  const regionName = useRegionNames();

  useEffect(() => {
    loadMasterData().then(setMaster).catch(() => undefined);
  }, []);

  const regions = useMemo(
    () => (master?.regions ?? []).filter((r) => !filters.residence_country || r.country === filters.residence_country),
    [master, filters.residence_country],
  );

  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => setFilters((f) => ({ ...f, [k]: f[k] === v ? undefined : v }));
  const toggleArr = (k: 'purposes' | 'interests', v: string) =>
    setFilters((f) => {
      const cur = f[k] ?? [];
      return { ...f, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      setResults(await searchProfiles(filters, 1, 50));
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">探す</h1>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal className="w-4 h-4" /> 条件
        </Button>
      </div>

      {open && master && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 text-sm">
          <div className="space-y-1">
            <Label>国籍</Label>
            <div className="flex gap-2">{NATIONALITIES.map((n) => <Chip key={n} active={filters.nationality === n} onClick={() => set('nationality', n)}>{NATIONALITY_LABELS[n]}</Chip>)}</div>
          </div>
          <div className="space-y-1">
            <Label>居住国</Label>
            <div className="flex gap-2">
              {NATIONALITIES.map((c) => (
                <Chip key={c} active={filters.residence_country === c} onClick={() => setFilters((f) => ({ ...f, residence_country: f.residence_country === c ? undefined : c, residence_region_id: undefined }))}>
                  {NATIONALITY_LABELS[c]}
                </Chip>
              ))}
            </div>
          </div>
          {filters.residence_country && filters.residence_country !== 'other' && (
            <select className="w-full h-9 rounded-md border border-gray-300 px-2 bg-white" value={filters.residence_region_id ?? ''} onChange={(e) => setFilters((f) => ({ ...f, residence_region_id: e.target.value || undefined }))}>
              <option value="">地域を選択</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{localizedName(r, lang)}</option>)}
            </select>
          )}
          <div className="space-y-1">
            <Label>性別</Label>
            <div className="flex gap-2">{GENDERS.map((g) => <Chip key={g} active={filters.gender === g} onClick={() => set('gender', g)}>{GENDER_LABELS[g]}</Chip>)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="shrink-0">年齢</Label>
            <Input type="number" className="w-20 h-8" placeholder="18" value={filters.age_min ?? ''} onChange={(e) => setFilters((f) => ({ ...f, age_min: e.target.value ? Number(e.target.value) : undefined }))} />
            <span>〜</span>
            <Input type="number" className="w-20 h-8" placeholder="99" value={filters.age_max ?? ''} onChange={(e) => setFilters((f) => ({ ...f, age_max: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <div className="space-y-1">
            <Label>利用目的</Label>
            <div className="flex flex-wrap gap-2">{master.purposes.map((p) => <Chip key={p.slug} active={filters.purposes?.includes(p.slug) ?? false} onClick={() => toggleArr('purposes', p.slug)}>{localizedName(p, lang)}</Chip>)}</div>
          </div>
          <div className="space-y-1">
            <Label>母語</Label>
            <div className="flex gap-2">{master.languages.map((l) => <Chip key={l.code} active={filters.native_language === l.code} onClick={() => set('native_language', l.code)}>{localizedName(l, lang)}</Chip>)}</div>
          </div>
          <div className="space-y-1">
            <Label>学習言語</Label>
            <div className="flex gap-2 flex-wrap">
              {master.languages.map((l) => <Chip key={l.code} active={filters.learning_language === l.code} onClick={() => set('learning_language', l.code)}>{localizedName(l, lang)}</Chip>)}
              {filters.learning_language && LEVELS.map((lv) => <Chip key={lv} active={filters.learning_level === lv} onClick={() => set('learning_level', lv)}>{LEVEL_LABELS[lv]}</Chip>)}
            </div>
          </div>
          <div className="space-y-1">
            <Label>趣味</Label>
            <div className="flex flex-wrap gap-2">{master.interests.map((i) => <Chip key={i.slug} active={filters.interests?.includes(i.slug) ?? false} onClick={() => toggleArr('interests', i.slug)}>{localizedName(i, lang)}</Chip>)}</div>
          </div>
          <div className="space-y-1">
            <Label>交流スタイル</Label>
            <div className="flex flex-wrap gap-2">{MEETING_PREFS.map((m) => <Chip key={m} active={filters.meeting_pref === m} onClick={() => set('meeting_pref', m)}>{MEETING_PREF_LABELS[m]}</Chip>)}</div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filters.verified_only ?? false} onChange={(e) => setFilters((f) => ({ ...f, verified_only: e.target.checked || undefined }))} />
            本人確認済みのみ
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setFilters({})}>クリア</Button>
            <Button className="flex-1 bg-rose-600 hover:bg-rose-700" onClick={run} disabled={loading}>{loading ? '検索中…' : '検索'}</Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!open && results.length === 0 && !loading && <p className="text-center text-gray-500 py-10">条件に合うユーザーが見つかりませんでした</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {results.map((p) => (
          <ProfileCard key={p.id} profile={p} regionName={regionName(p.residence_region_id)} footer={<LikeButton profile={p} liked={liked.has(p.id ?? '')} onLike={like} />} />
        ))}
      </div>
    </div>
  );
};
