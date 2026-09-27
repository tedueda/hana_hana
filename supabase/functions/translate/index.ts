// Edge Function: translate
//
// 認証済み会員だけが呼べるサーバー側翻訳。ブラウザから翻訳 API を直接呼ばない。
//   POST { message_id, target_lang }                 受信メッセージの翻訳 (会話参加者のみ・message_translations にキャッシュ)
//   POST { text, target_lang, source_lang? }         送信前の下書き翻訳 (キャッシュしない・上限は消費)
// 応答 { translated, detected_lang, target_lang, provider, cached, same_lang }
//
// 環境変数 (Supabase Dashboard → Edge Functions → Secrets)
//   TRANSLATION_PROVIDER = openai | deepl | mock  (未設定なら OPENAI_API_KEY → DEEPL_API_KEY → mock の順で自動選択)
//   OPENAI_API_KEY / OPENAI_MODEL(既定 gpt-4o-mini) / DEEPL_API_KEY / DEEPL_API_URL(既定 api-free.deepl.com)
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY は自動注入
import { createClient } from 'npm:@supabase/supabase-js@2';
import { detectLang } from './detect.ts';

type Provider = 'openai' | 'deepl' | 'mock';
interface Limits { max_chars: number; per_minute: number; per_day: number }
const DEFAULT_LIMITS: Limits = { max_chars: 1000, per_minute: 10, per_day: 200 };
const SUPPORTED = new Set(['ja', 'ko', 'en']);
const LANG_NAME: Record<string, string> = { ja: 'Japanese', ko: 'Korean', en: 'English' };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}) => json(status, { error: code, ...extra });

function pickProvider(): Provider {
  const p = Deno.env.get('TRANSLATION_PROVIDER');
  if (p === 'openai' || p === 'deepl' || p === 'mock') return p;
  if (Deno.env.get('OPENAI_API_KEY')) return 'openai';
  if (Deno.env.get('DEEPL_API_KEY')) return 'deepl';
  return 'mock';
}

async function translateWith(provider: Provider, text: string, source: string, target: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: ctl.signal,
        headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                `You are a translator for a Japan-Korea friendship chat app. Translate the user's message from ${LANG_NAME[source] ?? source} into ${LANG_NAME[target] ?? target}. ` +
                'Keep the tone natural and polite-casual, preserve emojis and line breaks, and output only the translation with no explanations or quotes.',
            },
            { role: 'user', content: text },
          ],
        }),
      });
      if (!res.ok) throw new Error(`openai ${res.status}`);
      const j = await res.json();
      const out = j?.choices?.[0]?.message?.content;
      if (typeof out !== 'string' || !out.trim()) throw new Error('openai empty');
      return out.trim();
    }
    if (provider === 'deepl') {
      const base = Deno.env.get('DEEPL_API_URL') ?? 'https://api-free.deepl.com';
      const res = await fetch(`${base}/v2/translate`, {
        method: 'POST',
        signal: ctl.signal,
        headers: { Authorization: `DeepL-Auth-Key ${Deno.env.get('DEEPL_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: [text], target_lang: target.toUpperCase(), ...(source !== 'und' ? { source_lang: source.toUpperCase() } : {}) }),
      });
      if (!res.ok) throw new Error(`deepl ${res.status}`);
      const j = await res.json();
      const out = j?.translations?.[0]?.text;
      if (typeof out !== 'string' || !out.trim()) throw new Error('deepl empty');
      return out;
    }
    return `[${target}] ${text}`;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return fail(401, 'unauthorized');

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return fail(401, 'unauthorized');
  const uid = userData.user.id;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { message_id?: string; text?: string; target_lang?: string; source_lang?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'invalid_json');
  }
  const target = body.target_lang ?? '';
  if (!SUPPORTED.has(target)) return fail(400, 'unsupported_target_lang');

  const { data: settings } = await admin.from('app_settings').select('key, value').in('key', ['translation_enabled', 'translation_limits']);
  const setting = (k: string) => settings?.find((s) => s.key === k)?.value;
  if (setting('translation_enabled') === false) return fail(403, 'translation_disabled');
  const limits: Limits = { ...DEFAULT_LIMITS, ...((setting('translation_limits') as Partial<Limits> | undefined) ?? {}) };

  const { data: member } = await admin.from('profiles').select('status').eq('id', uid).maybeSingle();
  if (!member || member.status !== 'active') return fail(403, 'inactive_member');

  let text: string;
  let sourceHint: string | undefined = body.source_lang;
  let kind: 'message' | 'draft';
  let messageId: string | null = null;

  if (body.message_id) {
    kind = 'message';
    messageId = body.message_id;
    const { data: m } = await admin
      .from('messages')
      .select('id, body, body_lang, deleted_at, conversations!inner(matches!inner(user_low_id, user_high_id))')
      .eq('id', messageId)
      .maybeSingle();
    if (!m || m.deleted_at) return fail(404, 'message_not_found');
    const match = (m.conversations as unknown as { matches: { user_low_id: string; user_high_id: string } }).matches;
    if (uid !== match.user_low_id && uid !== match.user_high_id) return fail(403, 'not_participant');
    text = m.body;
    sourceHint = sourceHint ?? m.body_lang ?? undefined;

    const { data: cached } = await admin
      .from('message_translations')
      .select('translated_body, provider')
      .eq('message_id', messageId)
      .eq('target_lang', target)
      .maybeSingle();
    if (cached) {
      await admin.from('translation_usage').insert({ user_id: uid, kind, target_lang: target, chars: text.length, provider: cached.provider, cached: true });
      return json(200, { translated: cached.translated_body, detected_lang: detectLang(text), target_lang: target, provider: cached.provider, cached: true, same_lang: false });
    }
  } else {
    kind = 'draft';
    text = (body.text ?? '').trim();
    if (!text) return fail(400, 'empty_text');
  }

  if (text.length > limits.max_chars) return fail(413, 'too_long', { max_chars: limits.max_chars });

  const detected = detectLang(text);
  const source = detected !== 'und' ? detected : (sourceHint ?? 'und');
  if (source === target) return json(200, { translated: text, detected_lang: source, target_lang: target, provider: null, cached: false, same_lang: true });

  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const [{ count: perMin }, { count: perDay }] = await Promise.all([
    admin.from('translation_usage').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('cached', false).gte('created_at', since(60_000)),
    admin.from('translation_usage').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('cached', false).gte('created_at', dayStart.toISOString()),
  ]);
  if ((perMin ?? 0) >= limits.per_minute) return fail(429, 'rate_limited', { retry_after_seconds: 60 });
  if ((perDay ?? 0) >= limits.per_day) return fail(429, 'daily_limit', { per_day: limits.per_day });

  const provider = pickProvider();
  let translated: string;
  try {
    translated = await translateWith(provider, text, source, target);
  } catch (e) {
    console.error('translate failed', provider, e instanceof Error ? e.message : e);
    return fail(502, 'provider_failed');
  }

  await admin.from('translation_usage').insert({ user_id: uid, kind, target_lang: target, chars: text.length, provider, cached: false });
  if (messageId) {
    await admin.from('message_translations').upsert(
      { message_id: messageId, target_lang: target, translated_body: translated, provider },
      { onConflict: 'message_id,target_lang' },
    );
  }
  return json(200, { translated, detected_lang: source, target_lang: target, provider, cached: false, same_lang: false });
});
