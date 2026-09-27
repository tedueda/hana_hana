import { getSupabase } from '@/lib/supabase';
import type { Interest, Language, Purpose, Region, UiLang } from '../types';

export interface MasterData {
  languages: Language[];
  interests: Interest[];
  purposes: Purpose[];
  regions: Region[];
}

let cache: Promise<MasterData> | null = null;

export function loadMasterData(): Promise<MasterData> {
  if (!cache) {
    cache = (async () => {
      const sb = getSupabase();
      const [languages, interests, purposes, regions] = await Promise.all([
        sb.from('languages').select('*').eq('is_active', true).order('sort_order'),
        sb.from('interests').select('*').eq('is_active', true).order('sort_order'),
        sb.from('purposes').select('*').eq('is_active', true).order('sort_order'),
        sb.from('regions').select('*').eq('is_active', true).order('country').order('sort_order'),
      ]);
      const err = languages.error ?? interests.error ?? purposes.error ?? regions.error;
      if (err) {
        cache = null;
        throw err;
      }
      return {
        languages: languages.data ?? [],
        interests: interests.data ?? [],
        purposes: purposes.data ?? [],
        regions: regions.data ?? [],
      };
    })();
  }
  return cache;
}

type Named = { name_ja: string; name_ko: string; name_en: string };

export function localizedName(row: Named | null | undefined, lang: UiLang): string {
  if (!row) return '';
  if (lang === 'ko') return row.name_ko;
  if (lang === 'en') return row.name_en;
  return row.name_ja;
}
