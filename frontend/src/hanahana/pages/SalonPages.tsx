import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Flag,
  Heart,
  ImagePlus,
  Languages,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { blockUser } from '../api/matching';
import { fetchMySettings, fetchPublicSettings, upsertMySettings } from '../api/settings';
import {
  createSalonComment,
  createSalonPost,
  deleteSalonComment,
  deleteSalonPost,
  fetchSalonCategories,
  fetchSalonComments,
  fetchSalonFeed,
  fetchSalonPost,
  fetchSalonTranslations,
  markSalonNotificationsRead,
  reportSalonContent,
  salonPhotoUrl,
  toggleReaction,
  updateSalonPost,
  uploadSalonPhoto,
  SALON_FEED_KINDS,
  type SalonCategory,
  type SalonComment,
  type SalonFeedItem,
  type SalonFeedKind,
} from '../api/salon';
import {
  TranslateError,
  guessLang,
  translateSalonComment,
  translateSalonPost,
} from '../api/translation';
import { Avatar } from '../components/ProfileCard';
import { REPORT_REASONS } from '../labels';
import { useErrorMessage, useLabels } from '../hooks';
import { formatDate, useI18n, type Lang } from '../i18n';
import type { MessageKey } from '../i18n/ja';
import type { ReportReason } from '../types';

// ---------------------------------------------------------------------------
// 共通

function categoryName(c: SalonCategory | undefined, lang: Lang): string {
  if (!c) return '';
  return lang === 'ko' ? c.name_ko : c.name_ja;
}

function useCategories(): SalonCategory[] {
  const [cats, setCats] = useState<SalonCategory[]>([]);
  useEffect(() => {
    fetchSalonCategories().then(setCats).catch(() => undefined);
  }, []);
  return cats;
}

/** トリガーの hint / errcode をユーザー向け文言へ */
function useSalonError(): (e: unknown) => string {
  const { t } = useI18n();
  const generic = useErrorMessage();
  return useCallback(
    (e: unknown) => {
      const hint = e && typeof e === 'object' && 'hint' in e ? String((e as { hint: unknown }).hint ?? '') : '';
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message ?? '') : '';
      if (hint === 'salon_post_limit') return t('salon.new.errLimit');
      if (hint === 'salon_comment_rate') return t('salon.comment.errRate');
      if (hint === 'salon_comment_limit') return t('salon.comment.errLimit');
      if (/onboarding required/.test(msg)) return t('salon.new.errOnboarding');
      if (/salon disabled/.test(msg)) return t('salon.disabled');
      if (/post closed|post not available/.test(msg)) return t('salon.comment.errClosed');
      return generic(e);
    },
    [t, generic],
  );
}

function useTranslateError(): (e: unknown) => string {
  const { t } = useI18n();
  const generic = useErrorMessage();
  return useCallback(
    (e: unknown) => {
      if (e instanceof TranslateError) {
        const map: Partial<Record<TranslateError['code'], MessageKey>> = {
          too_long: 'chat.errTooLong',
          rate_limited: 'chat.errRateLimited',
          daily_limit: 'chat.errDailyLimit',
          translation_disabled: 'chat.errDisabled',
          inactive_member: 'chat.errInactive',
          provider_failed: 'chat.errProvider',
          network: 'chat.errProvider',
        };
        const key = map[e.code];
        if (key) {
          const n =
            typeof e.detail.max_chars === 'number' ? e.detail.max_chars : typeof e.detail.per_day === 'number' ? e.detail.per_day : '';
          return t(key, { n });
        }
        return t('chat.translateFailed');
      }
      return generic(e);
    },
    [t, generic],
  );
}

const SalonPhoto: React.FC<{ path: string | null; className?: string }> = ({ path, className }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    salonPhotoUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path || !url) return null;
  return <img src={url} alt="" className={cn('w-full rounded-xl object-cover bg-gray-100', className)} loading="lazy" />;
};

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'min-h-10 px-3 rounded-full border text-sm break-keep shrink-0',
      active ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-gray-700 border-gray-300',
    )}
  >
    {children}
  </button>
);

type TrState = { status: 'loading' } | { status: 'done'; text: string; show: boolean } | { status: 'error'; message: string };

/** 原文 + AI翻訳の切替表示 */
const Translatable: React.FC<{
  original: string;
  lang: string;
  tr: TrState | undefined;
  enabled: boolean;
  onTranslate: () => void;
  onToggle: () => void;
  className?: string;
}> = ({ original, lang, tr, enabled, onTranslate, onToggle, className }) => {
  const { t, lang: uiLang } = useI18n();
  const same = lang !== 'und' ? lang === uiLang : guessLang(original) === uiLang;
  const showTr = tr?.status === 'done' && tr.show;
  return (
    <div className={className}>
      <p className="whitespace-pre-wrap break-words">{showTr ? tr.text : original}</p>
      {enabled && !same && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {tr?.status === 'done' ? (
            <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 text-rose-600">
              <Sparkles className="w-3 h-3" aria-hidden />
              {showTr ? t('salon.post.showOriginal') : t('salon.post.showTranslation')}
            </button>
          ) : tr?.status === 'loading' ? (
            <span className="text-gray-400">{t('salon.post.translating')}</span>
          ) : (
            <button type="button" onClick={onTranslate} className="inline-flex items-center gap-1 text-rose-600">
              <Sparkles className="w-3 h-3" aria-hidden />
              {t('salon.post.translate')}
            </button>
          )}
          {tr?.status === 'error' && <span className="text-red-600">{tr.message}</span>}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 一覧 /app/salon

const PostCard: React.FC<{ item: SalonFeedItem; cat?: SalonCategory; tr?: { title?: string; body?: string } }> = ({ item, cat, tr }) => {
  const { t, lang, locale } = useI18n();
  const pinned = !!item.pinned_until && new Date(item.pinned_until) > new Date();
  return (
    <Link
      to={`/app/salon/${item.id}`}
      className="block bg-white rounded-2xl border border-gray-100 p-4 space-y-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
    >
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">{categoryName(cat, lang as Lang)}</span>
        {pinned && (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <Pin className="w-3 h-3" aria-hidden />
            {t('salon.pinned')}
          </span>
        )}
        <span className="ml-auto">{formatDate(item.created_at, locale, { month: 'numeric', day: 'numeric' })}</span>
      </div>
      <h2 className="text-base font-semibold break-words leading-snug">{tr?.title ?? item.title}</h2>
      <p className="text-sm text-gray-600 line-clamp-2 break-words">{tr?.body ?? item.body}</p>
      {tr && (
        <p className="inline-flex items-center gap-1 text-[11px] text-rose-600">
          <Sparkles className="w-3 h-3" aria-hidden />
          {t('salon.feed.translatedBadge')}
        </p>
      )}
      {item.photo_path && <SalonPhoto path={item.photo_path} className="aspect-video" />}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Avatar path={item.author_photo_path} name={item.author_nickname} className="w-6 h-6 rounded-full" />
        <span className="truncate">{item.author_nickname}</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" aria-hidden />
          {item.comment_count}
        </span>
        <span className={cn('inline-flex items-center gap-1', item.reacted && 'text-rose-600')}>
          <Heart className="w-3.5 h-3.5" fill={item.reacted ? 'currentColor' : 'none'} aria-hidden />
          {item.reaction_count}
        </span>
      </div>
    </Link>
  );
};

export const SalonPage: React.FC = () => {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const cats = useCategories();
  const err = useSalonError();
  const kind = (params.get('kind') ?? 'new') as SalonFeedKind;
  const category = params.get('cat');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [items, setItems] = useState<SalonFeedItem[] | null>(null);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(true);
  const { user } = useSupabaseAuth();
  const trErr = useTranslateError();
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [targetLang, setTargetLang] = useState<string>(lang);
  const [feedTrs, setFeedTrs] = useState<Record<string, { title?: string; body?: string }>>({});
  const [showTr, setShowTr] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [trNotice, setTrNotice] = useState('');

  useEffect(() => {
    fetchPublicSettings()
      .then((p) => {
        setEnabled(p.salon_enabled);
        setTranslationEnabled(p.translation_enabled);
      })
      .catch(() => undefined);
    if (user) fetchMySettings(user.id).then((s) => s.translate_target_lang && setTargetLang(s.translate_target_lang)).catch(() => undefined);
    void markSalonNotificationsRead().catch(() => undefined);
  }, [user]);

  /** 翻訳対象 = 本文の言語が翻訳先と異なる投稿 */
  const needsTr = useCallback(
    (it: SalonFeedItem) => (it.body_lang !== 'und' ? it.body_lang : guessLang(`${it.title}\n${it.body}`)) !== targetLang,
    [targetLang],
  );

  // 一覧が変わったらキャッシュ済み翻訳を先に取り込む（翻訳回数を消費しない）
  useEffect(() => {
    if (!items || !translationEnabled) return;
    const targets = items.filter(needsTr).flatMap((it) => [
      { type: 'post_title' as const, id: it.id },
      { type: 'post_body' as const, id: it.id },
    ]);
    let alive = true;
    fetchSalonTranslations(targets, targetLang)
      .then((m) => {
        if (!alive) return;
        const cached: Record<string, { title?: string; body?: string }> = {};
        for (const [k, v] of m) {
          const [type, id] = k.split(':');
          cached[id] = { ...cached[id], [type === 'post_title' ? 'title' : 'body']: v };
        }
        setFeedTrs((prev) => {
          const next = { ...prev };
          for (const [id, v] of Object.entries(cached)) next[id] = { ...next[id], ...v };
          return next;
        });
        if (showTrRef.current) void runPending(items, cached, targetLang);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, targetLang, translationEnabled, needsTr]);

  const showTrRef = useRef(false);
  showTrRef.current = showTr;

  /** キャッシュに無い投稿を順に翻訳（上限到達・エラー時はそこで停止して理由を表示） */
  const runPending = async (list: SalonFeedItem[], known: Record<string, { title?: string; body?: string }>, target: string) => {
    const pending = list.filter((it) => needsTr(it) && !(known[it.id]?.title && known[it.id]?.body));
    if (pending.length === 0) return;
    setTranslating(true);
    setTrNotice('');
    try {
      for (const it of pending) {
        for (const field of ['title', 'body'] as const) {
          if (known[it.id]?.[field]) continue;
          const r = await translateSalonPost(it.id, field, target);
          setFeedTrs((prev) => ({ ...prev, [it.id]: { ...prev[it.id], [field]: r.translated } }));
        }
      }
    } catch (e) {
      setTrNotice(trErr(e));
    } finally {
      setTranslating(false);
    }
  };

  /** 右上のボタン: 表示中の投稿をまとめて翻訳 ⇄ 原文 */
  const translateFeed = () => {
    if (!items || translating) return;
    if (showTr) {
      setShowTr(false);
      return;
    }
    setShowTr(true);
    void runPending(items, feedTrs, targetLang);
  };

  const changeTarget = (l: string) => {
    if (l === targetLang) return;
    setTargetLang(l);
    setFeedTrs({});
    setTrNotice('');
    if (user) upsertMySettings(user.id, { translate_target_lang: l }).catch(() => undefined);
  };

  const query = params.get('q') ?? '';
  useEffect(() => {
    let alive = true;
    setError('');
    fetchSalonFeed({ kind, category, query })
      .then((r) => alive && setItems(r))
      .catch((e) => alive && setError(err(e)));
    return () => {
      alive = false;
    };
  }, [kind, category, query, err]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const kindLabel: Record<SalonFeedKind, MessageKey> = {
    new: 'salon.kind.new', hot: 'salon.kind.hot', replied: 'salon.kind.replied', joined: 'salon.kind.joined', mine: 'salon.kind.mine',
  };

  if (!enabled) return <p className="text-center text-gray-500 py-10">{t('salon.disabled')}</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{t('salon.title')}</h1>
          <p className="text-xs text-gray-500">{t('salon.lead')}</p>
        </div>
        <Button asChild size="sm" className="h-10 bg-rose-600 hover:bg-rose-700 shrink-0">
          <Link to="/app/salon/new"><Plus className="w-4 h-4" />{t('salon.newPost')}</Link>
        </Button>
      </div>

      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: q.trim() || null });
        }}
      >
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('salon.searchPlaceholder')} className="pl-9 h-11" aria-label={t('salon.searchPlaceholder')} />
        {q && (
          <button type="button" aria-label={t('common.clear')} onClick={() => { setQ(''); set({ q: null }); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
        <Chip active={!category} onClick={() => set({ cat: null })}>{t('salon.cat.all')}</Chip>
        {cats.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => set({ cat: c.id })}>{categoryName(c, lang as Lang)}</Chip>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]" role="tablist">
        {[...SALON_FEED_KINDS, 'mine' as const].map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => set({ kind: k === 'new' ? null : k })}
            className={cn('min-h-9 px-3 text-sm rounded-lg shrink-0', kind === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700')}
          >
            {t(kindLabel[k])}
          </button>
        ))}
      </div>

      <Link to="/app/legal/salon-rules" className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 rounded-xl p-3">
        <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden />
        <span>
          {t('salon.rulesShort')} <span className="underline">{t('salon.rules')}</span>
        </span>
      </Link>

      {translationEnabled && (
        <div className="sticky top-[calc(48px+env(safe-area-inset-top))] z-10 -mx-4 px-4 py-2 bg-gray-50/95 backdrop-blur">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-rose-50 border border-rose-100 rounded-xl">
            <Button
              type="button"
              size="sm"
              variant={showTr ? 'default' : 'outline'}
              aria-pressed={showTr}
              disabled={translating || !items?.length}
              onClick={() => void translateFeed()}
              className={cn('h-9 rounded-full px-3 gap-1', showTr ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100')}
            >
              <Sparkles className="w-4 h-4" aria-hidden />
              {translating ? t('salon.post.translating') : showTr ? t('salon.feed.showOriginal') : t('salon.post.translate')}
            </Button>
            <div className="ml-auto flex items-center gap-1 shrink-0 text-xs" role="group" aria-label={t('settings.translateTarget')}>
              <Languages className="w-3.5 h-3.5 text-rose-600" aria-hidden />
              <div className="flex rounded-full border border-rose-300 bg-white overflow-hidden">
                {(['ja', 'ko'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => changeTarget(l)}
                    aria-pressed={targetLang === l}
                    className={cn('px-3 min-h-8 font-medium', targetLang === l ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-100')}
                  >
                    {l === 'ja' ? '日本語' : '한국어'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {trNotice && <p className="text-xs text-red-600 mt-1" role="alert">{trNotice}</p>}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>}
      {items?.length === 0 && (
        <div className="text-center text-gray-500 py-12 space-y-2">
          <p className="font-medium text-gray-700">{t('salon.empty')}</p>
          <p className="text-sm">{t('salon.emptyLead')}</p>
        </div>
      )}
      <div className="space-y-3">
        {items?.map((it) => (
          <PostCard
            key={it.id}
            item={it}
            cat={cats.find((c) => c.id === it.category_id)}
            tr={showTr && needsTr(it) && feedTrs[it.id] ? feedTrs[it.id] : undefined}
          />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 作成・編集 /app/salon/new, /app/salon/:postId/edit

const MAX_PHOTO = 5 * 1024 * 1024;
const LANGS = ['und', 'ja', 'ko', 'en'] as const;

export const SalonNewPage: React.FC<{ edit?: boolean }> = ({ edit = false }) => {
  const { postId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const cats = useCategories();
  const err = useSalonError();
  const [params] = useSearchParams();
  const [category, setCategory] = useState(params.get('cat') ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [bodyLang, setBodyLang] = useState<(typeof LANGS)[number]>('und');
  const [photo, setPhoto] = useState<File | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!category && cats[0]) setCategory(cats[0].id);
  }, [cats, category]);

  useEffect(() => {
    if (!edit) return;
    fetchSalonPost(postId)
      .then((p) => {
        if (!p || p.author_id !== user?.id) {
          navigate('/app/salon', { replace: true });
          return;
        }
        setCategory(p.category_id);
        setTitle(p.title);
        setBody(p.body);
        setBodyLang(p.body_lang as (typeof LANGS)[number]);
        setExistingPhoto(p.photo_path);
      })
      .catch((e) => setError(err(e)));
  }, [edit, postId, user, navigate, err]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const contactWarn = useMemo(() => /(https?:\/\/|www\.|@[a-z0-9.-]+\.[a-z]{2,}|\d{2,4}[-‐ー ]?\d{3,4}[-‐ー ]?\d{4})/i.test(`${title}\n${body}`), [title, body]);

  const onPick = (f: File | null) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > MAX_PHOTO) {
      setError(t('salon.new.errPhoto'));
      return;
    }
    setError('');
    setPhoto(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    setError('');
    try {
      let photo_path: string | null = existingPhoto;
      if (photo) photo_path = await uploadSalonPhoto(user.id, photo);
      const input = { category_id: category, title: title.trim(), body: body.trim(), body_lang: bodyLang, photo_path };
      if (edit) {
        await updateSalonPost(postId, input);
        toast({ title: t('salon.edit.saved') });
        navigate(`/app/salon/${postId}`, { replace: true });
      } else {
        const id = await createSalonPost(user.id, input);
        toast({ title: t('salon.new.posted') });
        navigate(`/app/salon/${id}`, { replace: true });
      }
    } catch (ex) {
      setError(err(ex));
    } finally {
      setSaving(false);
    }
  };

  const langLabel = (l: (typeof LANGS)[number]) =>
    l === 'und' ? t('salon.new.langAuto') : l === 'ja' ? t('lang.ja') : l === 'ko' ? t('lang.ko') : t('lang.en');

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-1 -ml-2">
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold">{edit ? t('salon.edit.title') : t('salon.new.title')}</h1>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t('salon.new.category')}</label>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {cats.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{categoryName(c, lang as Lang)}</Chip>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="salon-title" className="text-sm font-medium">{t('salon.new.postTitle')}</label>
        <Input id="salon-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required className="h-11" />
        <p className="text-xs text-gray-400 text-right">{title.length}/80</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="salon-body" className="text-sm font-medium">{t('salon.new.body')}</label>
        <Textarea id="salon-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={8} required placeholder={t('salon.new.bodyPlaceholder')} />
        <p className="text-xs text-gray-400 text-right">{body.length}/3000</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t('salon.new.lang')}</label>
        <div className="flex gap-2 flex-wrap">
          {LANGS.map((l) => (
            <Chip key={l} active={bodyLang === l} onClick={() => setBodyLang(l)}>{langLabel(l)}</Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('salon.new.photo')}</label>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        {preview ? (
          <div className="relative">
            <img src={preview} alt="" className="w-full rounded-xl object-cover aspect-video" />
            <button type="button" aria-label={t('common.delete')} onClick={() => setPhoto(null)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : existingPhoto ? (
          <div className="relative">
            <SalonPhoto path={existingPhoto} className="aspect-video" />
            <button type="button" aria-label={t('common.delete')} onClick={() => setExistingPhoto(null)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="h-11 w-full" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="w-4 h-4" />{t('salon.new.photo')}
          </Button>
        )}
      </div>

      {contactWarn && <p className="text-xs text-amber-900 bg-amber-50 rounded-xl p-3">{t('salon.new.warnContact')}</p>}
      <Link to="/app/legal/salon-rules" className="block text-xs text-gray-500 underline">{t('salon.rules')}</Link>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <Button type="submit" disabled={saving || !title.trim() || !body.trim() || !category} className="w-full h-12 bg-rose-600 hover:bg-rose-700">
        {saving ? t('common.saving') : edit ? t('common.save') : t('salon.new.submit')}
      </Button>
    </form>
  );
};

// ---------------------------------------------------------------------------
// 詳細 /app/salon/:postId

export const SalonPostPage: React.FC = () => {
  const { postId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const { t, lang, locale } = useI18n();
  const { toast } = useToast();
  const L = useLabels();
  const cats = useCategories();
  const err = useSalonError();
  const trErr = useTranslateError();
  const [post, setPost] = useState<SalonFeedItem | null | undefined>(undefined);
  const [comments, setComments] = useState<SalonComment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [targetLang, setTargetLang] = useState<string>(lang);
  const [trs, setTrs] = useState<Record<string, TrState>>({});
  const [report, setReport] = useState<{ authorId: string; commentId?: string } | null>(null);
  const [reason, setReason] = useState<ReportReason>('inappropriate_content');
  const [detail, setDetail] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'deletePost' } | { kind: 'deleteComment'; id: string } | { kind: 'block'; userId: string } | null>(null);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([fetchSalonPost(postId), fetchSalonComments(postId)]);
    setPost(p);
    setComments(c);
  }, [postId]);

  useEffect(() => {
    load().catch((e) => {
      setPost(null);
      setError(err(e));
    });
    fetchPublicSettings().then((p) => setTranslationEnabled(p.translation_enabled)).catch(() => undefined);
    if (user) fetchMySettings(user.id).then((s) => s.translate_target_lang && setTargetLang(s.translate_target_lang)).catch(() => undefined);
  }, [load, err, user]);

  // 既存キャッシュを先に反映
  useEffect(() => {
    if (!post || !translationEnabled) return;
    const targets = [
      { type: 'post_title' as const, id: post.id },
      { type: 'post_body' as const, id: post.id },
      ...comments.map((c) => ({ type: 'comment' as const, id: c.id })),
    ];
    fetchSalonTranslations(targets, targetLang)
      .then((m) => {
        setTrs((prev) => {
          const next = { ...prev };
          for (const [k, v] of m) if (!next[k]) next[k] = { status: 'done', text: v, show: true };
          return next;
        });
      })
      .catch(() => undefined);
  }, [post, comments, targetLang, translationEnabled]);

  const key = (type: 'post_title' | 'post_body' | 'comment', id: string) => `${type}:${id}`;
  const toggle = (k: string) =>
    setTrs((prev) => (prev[k]?.status === 'done' ? { ...prev, [k]: { ...prev[k], show: !(prev[k] as { show: boolean }).show } } : prev));
  const run = async (k: string, fn: () => Promise<{ translated: string }>) => {
    setTrs((prev) => ({ ...prev, [k]: { status: 'loading' } }));
    try {
      const r = await fn();
      setTrs((prev) => ({ ...prev, [k]: { status: 'done', text: r.translated, show: true } }));
    } catch (e) {
      setTrs((prev) => ({ ...prev, [k]: { status: 'error', message: trErr(e) } }));
    }
  };
  const translatePost = () => {
    if (!post) return;
    void run(key('post_title', post.id), () => translateSalonPost(post.id, 'title', targetLang));
    void run(key('post_body', post.id), () => translateSalonPost(post.id, 'body', targetLang));
  };

  const changeTarget = (l: string) => {
    if (l === targetLang) return;
    setTargetLang(l);
    setTrs({});
    if (user) upsertMySettings(user.id, { translate_target_lang: l }).catch(() => undefined);
  };
  const postTranslated = trs[key('post_body', post?.id ?? '')]?.status === 'done';

  const react = async () => {
    if (!post || !user) return;
    const reacted = post.reacted;
    setPost({ ...post, reacted: !reacted, reaction_count: post.reaction_count + (reacted ? -1 : 1) });
    try {
      await toggleReaction(user.id, post.id, reacted);
    } catch (e) {
      setPost(post);
      toast({ title: t('common.errorTitle'), description: err(e), variant: 'destructive' });
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const body = text.trim();
      await createSalonComment(user.id, postId, body, guessLang(body));
      setText('');
      await load();
    } catch (ex) {
      setError(err(ex));
    } finally {
      setSending(false);
    }
  };

  const doConfirm = async () => {
    if (!confirm || !user) return;
    try {
      if (confirm.kind === 'deletePost') {
        await deleteSalonPost(postId);
        toast({ title: t('salon.post.deleted_toast') });
        navigate('/app/salon', { replace: true });
      } else if (confirm.kind === 'deleteComment') {
        await deleteSalonComment(confirm.id);
        await load();
      } else {
        await blockUser(user.id, confirm.userId);
        toast({ title: t('salon.post.blocked') });
        if (post?.author_id === confirm.userId) navigate('/app/salon', { replace: true });
        else await load();
      }
    } catch (e) {
      toast({ title: t('common.errorTitle'), description: err(e), variant: 'destructive' });
    } finally {
      setConfirm(null);
    }
  };

  const submitReport = async () => {
    if (!report || !user) return;
    try {
      await reportSalonContent(user.id, report.authorId, reason, detail, report.commentId ? { commentId: report.commentId } : { postId });
      toast({ title: t('salon.post.reported') });
      setReport(null);
      setDetail('');
    } catch (e) {
      toast({ title: t('common.errorTitle'), description: err(e), variant: 'destructive' });
    }
  };

  if (post === undefined) return <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>;
  if (!post) return <p className="text-center text-gray-500 py-10">{error || t('salon.post.notAvailable')}</p>;

  const mine = post.author_id === user?.id;
  const cat = cats.find((c) => c.id === post.category_id);
  const closed = !!post.deleted_at || post.is_hidden;

  const AuthorRow: React.FC<{ id: string; nickname: string; photo: string | null; date: string; small?: boolean }> = ({ id, nickname, photo, date, small }) => (
    <Link to={`/app/users/${id}`} className="flex items-center gap-2 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded-lg" aria-label={t('salon.post.viewProfile')}>
      <Avatar path={photo} name={nickname} className={cn(small ? 'w-7 h-7' : 'w-9 h-9', 'rounded-full shrink-0')} />
      <div className="min-w-0">
        <p className={cn('truncate', small ? 'text-xs font-medium' : 'text-sm font-medium')}>{nickname}</p>
        <p className="text-[11px] text-gray-400">{formatDate(date, locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 -ml-2">
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={() => navigate('/app/salon')} aria-label={t('common.back')}>
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">{categoryName(cat, lang as Lang)}</span>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={t('salon.post.more')}><MoreHorizontal className="w-5 h-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mine ? (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/app/salon/${post.id}/edit`)}><Pencil className="w-4 h-4" />{t('common.edit')}</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => setConfirm({ kind: 'deletePost' })}><Trash2 className="w-4 h-4" />{t('common.delete')}</DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/app/users/${post.author_id}`)}>{t('salon.post.viewProfile')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setReport({ authorId: post.author_id })}><Flag className="w-4 h-4" />{t('salon.post.report')}</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => setConfirm({ kind: 'block', userId: post.author_id })}><Ban className="w-4 h-4" />{t('salon.post.blockAuthor')}</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {post.deleted_at && <p className="text-xs text-gray-600 bg-gray-100 rounded-xl p-3">{t('salon.post.deleted')}</p>}
      {post.is_hidden && !post.deleted_at && (
        <p className="text-xs text-amber-900 bg-amber-50 rounded-xl p-3">{t('salon.post.hidden')}</p>
      )}
      {mine && post.flagged && !post.is_hidden && <p className="text-xs text-amber-900 bg-amber-50 rounded-xl p-3">{t('salon.post.flagged')}</p>}

      {translationEnabled && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-xl">
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-3 gap-1"
            onClick={postTranslated ? () => { toggle(key('post_title', post.id)); toggle(key('post_body', post.id)); } : translatePost}
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            {postTranslated ? t('salon.post.translated') : t('salon.post.translate')}
          </Button>
          <div className="ml-auto flex items-center gap-1" role="group" aria-label={t('settings.translateTarget')}>
            <Languages className="w-3.5 h-3.5 text-rose-600" aria-hidden />
            <div className="flex rounded-full border border-rose-300 bg-white overflow-hidden text-xs">
              {(['ja', 'ko'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => changeTarget(l)}
                  aria-pressed={targetLang === l}
                  className={cn('px-3 min-h-8 font-medium', targetLang === l ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-100')}
                >
                  {l === 'ja' ? '日本語' : '한국어'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <article className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <AuthorRow id={post.author_id} nickname={post.author_nickname} photo={post.author_photo_path} date={post.created_at} />
        <Translatable
          original={post.title}
          lang={post.body_lang}
          tr={trs[key('post_title', post.id)]}
          enabled={false}
          onTranslate={translatePost}
          onToggle={() => toggle(key('post_title', post.id))}
          className="text-lg font-bold leading-snug"
        />
        <Translatable
          original={post.body}
          lang={post.body_lang}
          tr={trs[key('post_body', post.id)]}
          enabled={translationEnabled}
          onTranslate={translatePost}
          onToggle={() => {
            toggle(key('post_title', post.id));
            toggle(key('post_body', post.id));
          }}
          className="text-sm leading-relaxed"
        />
        {post.photo_path && <SalonPhoto path={post.photo_path} />}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={react}
            disabled={closed}
            aria-pressed={post.reacted}
            className={cn('inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full border text-sm', post.reacted ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-700')}
          >
            <Heart className="w-4 h-4" fill={post.reacted ? 'currentColor' : 'none'} aria-hidden />
            {t('salon.reactions', { n: post.reaction_count })}
          </button>
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
            <MessageCircle className="w-4 h-4" aria-hidden />
            {t('salon.comments', { n: post.comment_count })}
          </span>
        </div>
      </article>

      <section className="space-y-3">
        <h2 className="font-semibold text-sm">{t('salon.comment.title')}</h2>
        {comments.length === 0 && <p className="text-sm text-gray-500 text-center py-4">{t('salon.comment.empty')}</p>}
        {comments.map((c) => {
          const cm = c.author_id === user?.id;
          const k = key('comment', c.id);
          return (
            <div key={c.id} className={cn('bg-white rounded-2xl border border-gray-100 p-3 space-y-2', c.is_hidden && 'opacity-60')}>
              <div className="flex items-start gap-2">
                <AuthorRow id={c.author_id} nickname={c.author_nickname} photo={c.author_photo_path} date={c.created_at} small />
                <div className="ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('salon.post.more')}><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {cm ? (
                        <DropdownMenuItem className="text-red-600" onClick={() => setConfirm({ kind: 'deleteComment', id: c.id })}><Trash2 className="w-4 h-4" />{t('common.delete')}</DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => navigate(`/app/users/${c.author_id}`)}>{t('salon.post.viewProfile')}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReport({ authorId: c.author_id, commentId: c.id })}><Flag className="w-4 h-4" />{t('salon.comment.report')}</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => setConfirm({ kind: 'block', userId: c.author_id })}><Ban className="w-4 h-4" />{t('salon.post.blockAuthor')}</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {c.is_hidden && <p className="text-[11px] text-amber-800">{t('salon.post.hidden')}</p>}
              <Translatable
                original={c.body}
                lang={c.body_lang}
                tr={trs[k]}
                enabled={translationEnabled}
                onTranslate={() => void run(k, () => translateSalonComment(c.id, targetLang))}
                onToggle={() => toggle(k)}
                className="text-sm leading-relaxed"
              />
            </div>
          );
        })}
      </section>

      <p className="text-[11px] text-gray-400">{t('salon.dmNote')}</p>

      {!closed && (
        <form onSubmit={send} className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] bg-gray-50 pt-2 pb-1 space-y-1">
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={1}
              placeholder={t('salon.comment.placeholder')}
              aria-label={t('salon.comment.placeholder')}
              className="min-h-[44px] max-h-32 bg-white"
            />
            <Button type="submit" disabled={sending || !text.trim()} className="h-11 bg-rose-600 hover:bg-rose-700 shrink-0">{t('salon.comment.send')}</Button>
          </div>
        </form>
      )}

      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('salon.post.reportTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 min-h-10 text-sm">
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                {L.reportReason[r]}
              </label>
            ))}
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={t('profile.reportDetail')} rows={3} />
            <Button onClick={submitReport} className="w-full h-11 bg-rose-600 hover:bg-rose-700">{t('common.send')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === 'deletePost' ? t('salon.post.deleteConfirm') : confirm?.kind === 'deleteComment' ? t('salon.comment.deleteConfirm') : t('salon.post.blockConfirm')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-11" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" className="flex-1 h-11" onClick={doConfirm}>{t('common.confirm')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalonPage;
