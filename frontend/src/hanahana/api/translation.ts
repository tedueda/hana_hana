import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

export type MessageTranslation = Database['public']['Tables']['message_translations']['Row'];

export interface TranslateResult {
  translated: string;
  detected_lang: string;
  target_lang: string;
  provider: string | null;
  cached: boolean;
  same_lang: boolean;
}

export type TranslateErrorCode =
  | 'unauthorized'
  | 'translation_disabled'
  | 'inactive_member'
  | 'message_not_found'
  | 'not_participant'
  | 'too_long'
  | 'rate_limited'
  | 'daily_limit'
  | 'provider_failed'
  | 'unsupported_target_lang'
  | 'empty_text'
  | 'network';

export class TranslateError extends Error {
  constructor(
    public code: TranslateErrorCode,
    public detail: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

const KNOWN: ReadonlySet<string> = new Set<TranslateErrorCode>([
  'unauthorized', 'translation_disabled', 'inactive_member', 'message_not_found', 'not_participant',
  'too_long', 'rate_limited', 'daily_limit', 'provider_failed', 'unsupported_target_lang', 'empty_text',
]);

async function invoke(body: Record<string, string>): Promise<TranslateResult> {
  const { data, error } = await getSupabase().functions.invoke<TranslateResult>('translate', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const j: unknown = await error.context.json().catch(() => null);
      if (j && typeof j === 'object' && 'error' in j) {
        const { error: code, ...detail } = j as { error: string } & Record<string, unknown>;
        if (KNOWN.has(code)) throw new TranslateError(code as TranslateErrorCode, detail);
      }
      throw new TranslateError('provider_failed');
    }
    throw new TranslateError('network');
  }
  if (!data) throw new TranslateError('network');
  return data;
}

/** 受信メッセージを翻訳 (サーバー側で参加者確認・キャッシュ・上限を適用) */
export function translateMessage(messageId: string, targetLang: string): Promise<TranslateResult> {
  return invoke({ message_id: messageId, target_lang: targetLang });
}

/** 送信前の下書き翻訳。候補は利用者が確認・編集してから送信する */
export function translateDraft(text: string, targetLang: string, sourceLang?: string): Promise<TranslateResult> {
  return invoke({ text, target_lang: targetLang, ...(sourceLang ? { source_lang: sourceLang } : {}) });
}

/** 既存キャッシュを一括取得 (RLS で会話参加者のみ) */
export async function fetchCachedTranslations(
  messageIds: string[],
  targetLang: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (messageIds.length === 0) return out;
  const { data, error } = await getSupabase()
    .from('message_translations')
    .select('message_id, translated_body')
    .eq('target_lang', targetLang)
    .in('message_id', messageIds);
  if (error) throw error;
  for (const r of data ?? []) out.set(r.message_id, r.translated_body);
  return out;
}

export interface TranslationUsage {
  used_today: number;
  used_last_minute: number;
  per_day: number;
  per_minute: number;
  max_chars: number;
}

export async function fetchTranslationUsage(): Promise<TranslationUsage | null> {
  const { data, error } = await getSupabase().rpc('my_translation_usage');
  if (error) throw error;
  return data?.[0] ?? null;
}

/** ブラウザ側の簡易言語判定 (同一言語なら翻訳ボタンを出さないための目安。サーバー側でも再判定する) */
export function guessLang(text: string): 'ja' | 'ko' | 'en' | 'und' {
  let ko = 0;
  let ja = 0;
  let cjk = 0;
  let latin = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f)) ko++;
    else if ((c >= 0x3040 && c <= 0x309f) || (c >= 0x30a0 && c <= 0x30ff)) ja++;
    else if (c >= 0x4e00 && c <= 0x9fff) cjk++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin++;
  }
  if (ko > 0 && ko >= ja) return 'ko';
  if (ja > 0 || cjk > 0) return 'ja';
  if (latin > 0) return 'en';
  return 'und';
}

/** サロン投稿 (title/body) の翻訳。サーバー側で可視性・キャッシュ・上限を適用 */
export function translateSalonPost(postId: string, field: 'title' | 'body', targetLang: string): Promise<TranslateResult> {
  return invoke({ salon_post_id: postId, field, target_lang: targetLang });
}

/** サロンコメントの翻訳 */
export function translateSalonComment(commentId: string, targetLang: string): Promise<TranslateResult> {
  return invoke({ salon_comment_id: commentId, target_lang: targetLang });
}
