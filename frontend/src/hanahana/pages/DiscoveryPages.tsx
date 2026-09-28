import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ChevronRight, Heart, Info, MapPin, MessagesSquare, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { useErrorMessage, useLabels, useLikeAction, useRegionNames } from '../hooks';
import { useI18n } from '../i18n';
import {
  fetchRecommendations, isEmptyFilters, loadSavedSearch, passUser, saveSearch, searchProfiles, undoPass,
} from '../api/discovery';
import { loadMasterData, localizedName, type MasterData } from '../api/master';
import { fetchProfileDetails, type ProfileDetails } from '../api/profile';
import { DEFAULT_PUBLIC_SETTINGS, fetchPublicSettings, type PublicSettings } from '../api/settings';
import { Avatar } from '../components/ProfileCard';
import MatchModal from '../components/MatchModal';
import { GENDERS, LEVELS, MEETING_PREFS, NATIONALITIES } from '../labels';
import type { PublicProfile, RecommendedUser, SearchFilters, UiLang } from '../types';

const FLAG: Record<string, string> = { JP: '🇯🇵', KR: '🇰🇷' };

export const LikeButton: React.FC<{ profile: PublicProfile; liked: boolean; onLike: (p: PublicProfile) => void }> = ({ profile, liked, onLike }) => {
  const { t } = useI18n();
  return (
    <Button
      size="sm"
      variant={liked ? 'secondary' : 'default'}
      className={cn('w-full mt-1', !liked && 'bg-rose-600 hover:bg-rose-700')}
      disabled={liked}
      onClick={() => onLike(profile)}
    >
      <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
      {liked ? t('likes.liked') : t('likes.like')}
    </Button>
  );
};

function useMaster(): MasterData | null {
  const [master, setMaster] = useState<MasterData | null>(null);
  useEffect(() => {
    loadMasterData().then(setMaster).catch(() => undefined);
  }, []);
  return master;
}

function usePublicSettings(): PublicSettings {
  const [s, setS] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  useEffect(() => {
    fetchPublicSettings().then(setS).catch(() => undefined);
  }, []);
  return s;
}

/* ------------------------------------------------------------------ */
/* おすすめ: 1人ずつ大きなカード                                        */
/* ------------------------------------------------------------------ */

const BigCard: React.FC<{
  item: RecommendedUser;
  regionName?: string;
  master: MasterData | null;
  lang: UiLang;
}> = ({ item, regionName, master, lang }) => {
  const { t } = useI18n();
  const L = useLabels();
  const p = item.profile;
  const [details, setDetails] = useState<ProfileDetails | null>(null);

  useEffect(() => {
    setDetails(null);
    fetchProfileDetails(item.id).then(setDetails).catch(() => undefined);
  }, [item.id]);

  const langName = (code: string) => localizedName(master?.languages.find((l) => l.code === code), lang) || code;
  const natives = details?.languages.filter((l) => l.role === 'native') ?? [];
  const learning = details?.languages.filter((l) => l.role === 'learning') ?? [];
  const purposes = (details?.purposeIds ?? [])
    .map((id) => master?.purposes.find((x) => x.id === id))
    .flatMap((x) => (x ? [localizedName(x, lang)] : []));

  return (
    <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
      <Link to={`/app/users/${p.id}`} className="block relative">
        <Avatar path={p.primary_photo_path} name={p.nickname} className="w-full aspect-[3/4]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 pt-14 text-white">
          <div className="flex items-end gap-2 flex-wrap">
            <span className="text-2xl font-bold break-all">{p.nickname ?? t('profile.unnamed')}</span>
            {p.age != null && <span className="text-xl">{p.age}</span>}
            {p.is_verified && <BadgeCheck className="w-6 h-6 text-sky-300 mb-0.5" aria-label={t('profile.verifiedBadge')} />}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-white/90 mt-1 flex-wrap">
            {p.nationality && (
              <span>
                {FLAG[p.nationality] ? `${FLAG[p.nationality]} ` : ''}
                {L.nationality[p.nationality]}
              </span>
            )}
            {regionName && (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>{regionName}</span>
              </>
            )}
          </div>
        </div>
      </Link>
      <div className="p-4 space-y-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {natives.length > 0 && (
            <Badge variant="outline" className="font-normal border-gray-200">
              {t('discover.native')}: {natives.map((l) => langName(l.language_code)).join(' / ')}
            </Badge>
          )}
          {learning.length > 0 && (
            <Badge variant="outline" className="font-normal border-gray-200">
              {t('discover.learning')}: {learning.map((l) => `${langName(l.language_code)}${l.level ? `(${L.level[l.level]})` : ''}`).join(' / ')}
            </Badge>
          )}
          {p.is_verified ? (
            <Badge className="font-normal bg-sky-50 text-sky-700 hover:bg-sky-50 border border-sky-100">
              <BadgeCheck className="w-3 h-3 mr-1" />{t('profile.verified')}
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal text-gray-400 border-gray-200">{t('discover.unverified')}</Badge>
          )}
        </div>
        {purposes.length > 0 && (
          <p className="text-gray-700 break-words">
            <span className="text-gray-400 mr-1">{t('discover.purposes')}:</span>
            {purposes.join('・')}
          </p>
        )}
        {item.reasons.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">{t('discover.whyTitle')}</p>
            <div className="flex flex-wrap gap-1">
              {item.reasons.map((r) => (
                <Badge key={r} variant="secondary" className="font-normal bg-rose-50 text-rose-700 hover:bg-rose-50">
                  {L.reason[r] ?? r}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {p.bio && <p className="text-gray-600 line-clamp-3 whitespace-pre-wrap break-words">{p.bio}</p>}
      </div>
    </div>
  );
};

export const RecommendPage: React.FC = () => {
  const { profile } = useSupabaseAuth();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const errorMessage = useErrorMessage();
  const master = useMaster();
  const settings = usePublicSettings();
  const regionName = useRegionNames();
  const { liked, like, matched, dismissMatch } = useLikeAction();
  const [items, setItems] = useState<RecommendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchRecommendations(30)
      .then(setItems)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [errorMessage]);
  useEffect(load, [load]);

  const current = items[0];
  const advance = () => setItems((xs) => xs.slice(1));

  const onPass = async () => {
    if (!current || busy) return;
    setBusy(true);
    const passed = current;
    try {
      await passUser(passed.id);
      advance();
      const { dismiss } = toast({
        title: t('discover.passed'),
        description: t('discover.passedLead', { days: settings.pass_cooldown_days }),
        action: (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              dismiss();
              try {
                await undoPass(passed.id);
                setItems((xs) => (xs.some((x) => x.id === passed.id) ? xs : [passed, ...xs]));
              } catch (e) {
                toast({ title: t('common.errorTitle'), description: errorMessage(e), variant: 'destructive' });
              }
            }}
          >
            <RotateCcw className="w-4 h-4" />{t('discover.undo')}
          </Button>
        ),
      });
    } catch (e) {
      toast({ title: t('common.errorTitle'), description: errorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const onLike = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const res = await like(current.profile);
      if (res) advance();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t('discover.title')}</h1>
        <p className="text-sm text-gray-500 break-words">
          {profile?.nickname ? t('discover.lead', { name: profile.nickname }) : t('discover.leadAnon')}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>
      ) : !current ? (
        <div className="text-center text-gray-500 py-10 space-y-4 px-4">
          <div className="space-y-1">
            <p className="font-medium text-gray-700">{t('discover.empty')}</p>
            <p className="text-sm break-words">{t('discover.emptyLead', { days: settings.pass_cooldown_days })}</p>
          </div>
          <div className="flex flex-col gap-2 max-w-xs mx-auto">
            <Button variant="outline" onClick={load}><RotateCcw className="w-4 h-4" />{t('discover.reload')}</Button>
            <Button variant="outline" asChild><Link to="/app/profile/edit">{t('discover.editPrefs')}</Link></Button>
            <Button variant="ghost" asChild><Link to="/app/search">{t('discover.goSearch')}</Link></Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 text-right">{t('discover.remaining', { n: items.length })}</p>
          <BigCard item={current} regionName={regionName(current.profile.residence_region_id)} master={master} lang={lang as UiLang} />
          <div className="grid grid-cols-3 gap-3">
            <Button variant="outline" className="h-14 rounded-2xl flex-col gap-0.5 text-xs bg-white" asChild>
              <Link to={`/app/users/${current.id}`}><Info className="w-5 h-5" />{t('discover.detail')}</Link>
            </Button>
            <Button variant="outline" className="h-14 rounded-2xl flex-col gap-0.5 text-xs bg-white" onClick={onPass} disabled={busy}>
              <X className="w-5 h-5" />{t('discover.pass')}
            </Button>
            <Button
              className="h-14 rounded-2xl flex-col gap-0.5 text-xs bg-rose-600 hover:bg-rose-700"
              onClick={onLike}
              disabled={busy || liked.has(current.id)}
            >
              <Heart className={cn('w-5 h-5', liked.has(current.id) && 'fill-current')} />
              {liked.has(current.id) ? t('likes.liked') : t('likes.like')}
            </Button>
          </div>
        </>
      )}
      <MatchModal match={matched} onClose={dismissMatch} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 探す: カテゴリ + 写真グリッド + 条件シート                            */
/* ------------------------------------------------------------------ */

type Category = 'all' | 'new' | 'learningJa' | 'learningKo';
const CATEGORIES: Category[] = ['all', 'new', 'learningJa', 'learningKo'];
const PAGE_SIZE = 50;

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'min-h-10 px-3 rounded-full border text-sm break-keep',
      active ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-gray-700 border-gray-300',
    )}
  >
    {children}
  </button>
);

const GridCard: React.FC<{
  profile: PublicProfile;
  regionName?: string;
  liked: boolean;
  onLike: (p: PublicProfile) => void;
}> = ({ profile: p, regionName, liked, onLike }) => {
  const { t } = useI18n();
  const L = useLabels();
  return (
    <div className="relative rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
      <Link to={`/app/users/${p.id}`} className="block relative">
        <Avatar path={p.primary_photo_path} name={p.nickname} className="w-full aspect-[3/4]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-8 text-white">
          <div className="flex items-center gap-1">
            <span className="font-semibold truncate">{p.nickname ?? t('profile.unnamed')}</span>
            {p.age != null && <span className="text-sm shrink-0">{p.age}</span>}
            {p.is_verified && <BadgeCheck className="w-4 h-4 text-sky-300 shrink-0" aria-label={t('profile.verifiedBadge')} />}
          </div>
          <p className="text-[11px] text-white/90 truncate">
            {p.nationality ? `${FLAG[p.nationality] ?? ''} ${L.nationality[p.nationality]}` : ''}
            {regionName ? ` · ${regionName}` : ''}
          </p>
        </div>
      </Link>
      <button
        type="button"
        aria-label={liked ? t('likes.liked') : t('likes.like')}
        disabled={liked}
        onClick={() => onLike(p)}
        className={cn(
          'absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center shadow',
          liked ? 'bg-white/90 text-rose-500' : 'bg-white/90 text-gray-500 hover:text-rose-500',
        )}
      >
        <Heart className={cn('w-5 h-5', liked && 'fill-current')} />
      </button>
    </div>
  );
};

function countFilters(f: SearchFilters): number {
  return isEmptyFilters(f) ? 0 : Object.entries(f).filter(([k, v]) =>
    k !== 'sort' && k !== 'joined_within_days' && k !== 'learning_level'
    && v !== undefined && v !== null && v !== '' && v !== false && !(Array.isArray(v) && v.length === 0)).length;
}

export const SearchPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const { t, lang } = useI18n();
  const uiLang = lang as UiLang;
  const { toast } = useToast();
  const errorMessage = useErrorMessage();
  const L = useLabels();
  const master = useMaster();
  const settings = usePublicSettings();
  const regionName = useRegionNames();
  const { liked, like, matched, dismissMatch } = useLikeAction();

  const [category, setCategory] = useState<Category>('all');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [draft, setDraft] = useState<SearchFilters>({});
  const [results, setResults] = useState<PublicProfile[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedLoaded, setSavedLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadSavedSearch(user.id)
      .then((s) => { if (s) setFilters(s); })
      .catch(() => undefined)
      .finally(() => setSavedLoaded(true));
  }, [user]);

  const categoryFilters = useMemo((): SearchFilters => {
    switch (category) {
      case 'new': return { joined_within_days: settings.new_member_days, sort: 'new' };
      case 'learningJa': return { learning_language: 'ja' };
      case 'learningKo': return { learning_language: 'ko' };
      default: return {};
    }
  }, [category, settings.new_member_days]);

  useEffect(() => {
    if (!savedLoaded) return;
    let alive = true;
    setLoading(true);
    setError('');
    searchProfiles({ ...filters, ...categoryFilters }, 1, PAGE_SIZE)
      .then((r) => alive && setResults(r))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [filters, categoryFilters, savedLoaded, errorMessage]);

  const openSheet = () => { setDraft(filters); setOpen(true); };
  const apply = () => { setFilters(draft); setOpen(false); };
  const clear = async () => {
    setDraft({});
    setFilters({});
    setOpen(false);
    if (user) await saveSearch(user.id, null).catch(() => undefined);
    toast({ title: t('search.cleared') });
  };
  const save = async () => {
    if (!user) return;
    try {
      await saveSearch(user.id, isEmptyFilters(draft) ? null : draft);
      setFilters(draft);
      setOpen(false);
      toast({ title: t('search.saved') });
    } catch (e) {
      toast({ title: t('common.errorTitle'), description: errorMessage(e), variant: 'destructive' });
    }
  };

  const regions = useMemo(
    () => (master?.regions ?? []).filter((r) => !draft.residence_country || r.country === draft.residence_country),
    [master, draft.residence_country],
  );
  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => setDraft((f) => ({ ...f, [k]: f[k] === v ? undefined : v }));
  const toggleArr = (k: 'purposes' | 'interests', v: string) =>
    setDraft((f) => {
      const cur = f[k] ?? [];
      return { ...f, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  const nFilters = countFilters(filters);
  const catLabel: Record<Category, string> = {
    all: t('search.cat.all'), new: t('search.cat.new'), learningJa: t('search.cat.learningJa'), learningKo: t('search.cat.learningKo'),
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('search.title')}</h1>
        <Button variant={nFilters ? 'default' : 'outline'} size="sm" className={cn('h-10', nFilters && 'bg-rose-600 hover:bg-rose-700')} onClick={openSheet}>
          <SlidersHorizontal className="w-4 h-4" />
          {nFilters ? t('search.activeFilters', { n: nFilters }) : t('search.filter')}
        </Button>
      </div>

      <Link
        to="/app/salon"
        className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 to-orange-50 p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        <MessagesSquare className="w-6 h-6 text-rose-500 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('salon.title')}</p>
          <p className="text-xs text-gray-600 truncate">{t('salon.entryLead')}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden />
      </Link>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{catLabel[c]}</Chip>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {results !== null && !loading && (
        <p className="text-xs text-gray-500">
          {results.length >= PAGE_SIZE ? t('search.countMax', { n: results.length }) : t('search.count', { n: results.length })}
        </p>
      )}
      {loading && results === null && <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>}
      {results?.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-12 space-y-3 px-4">
          <p className="font-medium text-gray-700">{t('search.empty')}</p>
          <p className="text-sm">{t('search.emptyLead')}</p>
          {nFilters > 0 && <Button variant="outline" onClick={clear}>{t('common.clear')}</Button>}
        </div>
      )}
      <div className={cn('grid grid-cols-2 sm:grid-cols-3 gap-3', loading && 'opacity-60')}>
        {results?.map((p) => (
          <GridCard key={p.id} profile={p} regionName={regionName(p.residence_region_id)} liked={liked.has(p.id ?? '')} onLike={like} />
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto p-0">
          <SheetHeader className="p-4 pb-2 text-left">
            <SheetTitle>{t('search.sheetTitle')}</SheetTitle>
          </SheetHeader>
          {master && (
            <div className="px-4 pb-28 space-y-4 text-sm">
              <div className="space-y-1.5">
                <Label>{t('search.nationality')}</Label>
                <div className="flex flex-wrap gap-2">{NATIONALITIES.map((n) => <Chip key={n} active={draft.nationality === n} onClick={() => set('nationality', n)}>{L.nationality[n]}</Chip>)}</div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('search.country')}</Label>
                <div className="flex flex-wrap gap-2">
                  {NATIONALITIES.map((c) => (
                    <Chip key={c} active={draft.residence_country === c} onClick={() => setDraft((f) => ({ ...f, residence_country: f.residence_country === c ? undefined : c, residence_region_id: undefined }))}>
                      {L.country[c]}
                    </Chip>
                  ))}
                </div>
                {draft.residence_country && draft.residence_country !== 'other' && (
                  <select className="w-full h-10 rounded-md border border-gray-300 px-2 bg-white" value={draft.residence_region_id ?? ''} onChange={(e) => setDraft((f) => ({ ...f, residence_region_id: e.target.value || undefined }))}>
                    <option value="">{t('search.region')}</option>
                    {regions.map((r) => <option key={r.id} value={r.id}>{localizedName(r, uiLang)}</option>)}
                  </select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('search.gender')}</Label>
                <div className="flex flex-wrap gap-2">{GENDERS.map((g) => <Chip key={g} active={draft.gender === g} onClick={() => set('gender', g)}>{L.gender[g]}</Chip>)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="shrink-0">{t('search.age')}</Label>
                <Input type="number" inputMode="numeric" className="w-20 h-10" placeholder="18" value={draft.age_min ?? ''} onChange={(e) => setDraft((f) => ({ ...f, age_min: e.target.value ? Number(e.target.value) : undefined }))} />
                <span>〜</span>
                <Input type="number" inputMode="numeric" className="w-20 h-10" placeholder="99" value={draft.age_max ?? ''} onChange={(e) => setDraft((f) => ({ ...f, age_max: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('search.purposes')}</Label>
                <div className="flex flex-wrap gap-2">{master.purposes.map((p) => <Chip key={p.slug} active={draft.purposes?.includes(p.slug) ?? false} onClick={() => toggleArr('purposes', p.slug)}>{localizedName(p, uiLang)}</Chip>)}</div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('search.native')}</Label>
                <div className="flex flex-wrap gap-2">{master.languages.map((l) => <Chip key={l.code} active={draft.native_language === l.code} onClick={() => set('native_language', l.code)}>{localizedName(l, uiLang)}</Chip>)}</div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('search.learning')}</Label>
                <div className="flex gap-2 flex-wrap">
                  {master.languages.map((l) => <Chip key={l.code} active={draft.learning_language === l.code} onClick={() => setDraft((f) => ({ ...f, learning_language: f.learning_language === l.code ? undefined : l.code, learning_level: undefined }))}>{localizedName(l, uiLang)}</Chip>)}
                </div>
                {draft.learning_language && (
                  <div className="flex gap-2 flex-wrap">
                    {LEVELS.map((lv) => <Chip key={lv} active={draft.learning_level === lv} onClick={() => set('learning_level', lv)}>{L.level[lv]}</Chip>)}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('search.interests')}</Label>
                <div className="flex flex-wrap gap-2">{master.interests.map((i) => <Chip key={i.slug} active={draft.interests?.includes(i.slug) ?? false} onClick={() => toggleArr('interests', i.slug)}>{localizedName(i, uiLang)}</Chip>)}</div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('search.meeting')}</Label>
                <div className="flex flex-wrap gap-2">{MEETING_PREFS.map((m) => <Chip key={m} active={draft.meeting_pref === m} onClick={() => set('meeting_pref', m)}>{L.meetingPref[m]}</Chip>)}</div>
              </div>
              <label className="flex items-center gap-2 min-h-10">
                <input type="checkbox" className="w-5 h-5" checked={draft.verified_only ?? false} onChange={(e) => setDraft((f) => ({ ...f, verified_only: e.target.checked || undefined }))} />
                {t('search.verifiedOnly')}
              </label>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-white/95 backdrop-blur border-t border-gray-100 p-3 grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-11" onClick={clear}>{t('common.clear')}</Button>
            <Button variant="outline" className="h-11" onClick={save}>{t('search.save')}</Button>
            <Button className="h-11 bg-rose-600 hover:bg-rose-700" onClick={apply}>{t('search.apply')}</Button>
          </div>
        </SheetContent>
      </Sheet>

      <MatchModal match={matched} onClose={dismissMatch} />
    </div>
  );
};
