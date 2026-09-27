import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ja, type MessageKey } from './ja';
import { ko } from './ko';
import type { UiLang } from '../types';

export type Lang = 'ja' | 'ko';
export const LANGS: Lang[] = ['ja', 'ko'];
export const LANG_NAMES: Record<Lang, string> = { ja: '日本語', ko: '한국어' };
export const STORAGE_KEY = 'hanahana.uiLang';

const DICTS: Record<Lang, Record<MessageKey, string>> = { ja, ko };

export type Params = Record<string, string | number>;
export type TFunction = (key: MessageKey, params?: Params) => string;

export function normalizeLang(v: string | null | undefined): Lang {
  return v === 'ko' ? 'ko' : 'ja';
}

export function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLang(stored);
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  return nav.toLowerCase().startsWith('ko') ? 'ko' : 'ja';
}

export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const raw = DICTS[lang][key] ?? DICTS.ja[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunction;
  locale: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextType>(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
      locale: lang === 'ko' ? 'ko-KR' : 'ja-JP',
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useT(): TFunction {
  return useI18n().t;
}

/** DB の preferred_ui_lang (ja/ko/en) を表示言語へ丸める */
export function uiLangToLang(v: UiLang | string | null | undefined): Lang {
  return normalizeLang(v);
}

export function formatDate(d: string | Date | null | undefined, locale: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!d) return '';
  return new Date(d).toLocaleString(locale, opts ?? { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(d: string | Date | null | undefined, locale: string): string {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
