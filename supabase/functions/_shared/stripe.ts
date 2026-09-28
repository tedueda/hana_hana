// Stripe 共通ヘルパー (Edge Functions 用)。テストモード前提: sk_live_ が設定されていれば起動を拒否する。
import Stripe from 'npm:stripe@17.7.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
export const fail = (status: number, code: string, extra: Record<string, unknown> = {}) => json(status, { error: code, ...extra });

export function stripeClient(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    throw new Error('STRIPE_SECRET_KEY must be a test-mode key (sk_test_...)');
  }
  return new Stripe(key, { apiVersion: '2025-02-24.acacia', httpClient: Stripe.createFetchHttpClient() });
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

export async function requireUser(req: Request): Promise<{ uid: string; email: string | null } | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return { uid: data.user.id, email: data.user.email ?? null };
}

export async function allowedOrigin(admin: SupabaseClient, requested: string | undefined): Promise<string | null> {
  const { data } = await admin.from('app_settings').select('value').eq('key', 'billing_allowed_origins').maybeSingle();
  const list = Array.isArray(data?.value) ? (data!.value as string[]) : [];
  if (!requested) return list[0] ?? null;
  return list.includes(requested) ? requested : null;
}

// user ↔ Stripe Customer (無ければ作成)
export async function ensureCustomer(stripe: Stripe, admin: SupabaseClient, uid: string, email: string | null): Promise<string> {
  const { data } = await admin.from('billing_customers').select('stripe_customer_id').eq('user_id', uid).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const { data: prof } = await admin.from('profiles').select('nickname').eq('id', uid).maybeSingle();
  const customer = await stripe.customers.create(
    { email: email ?? undefined, name: prof?.nickname ?? undefined, metadata: { user_id: uid } },
    { idempotencyKey: `customer:${uid}` },
  );
  const { error } = await admin.from('billing_customers').insert({ user_id: uid, stripe_customer_id: customer.id, livemode: customer.livemode });
  if (error) {
    // 競合時は既存を返す
    const { data: again } = await admin.from('billing_customers').select('stripe_customer_id').eq('user_id', uid).maybeSingle();
    if (again?.stripe_customer_id) return again.stripe_customer_id;
    throw error;
  }
  return customer.id;
}

// Billing Portal 設定 (プラン変更 standard⇄premium・解約・支払い方法・請求履歴)。初回に作成し app_settings に保存
export async function portalConfiguration(stripe: Stripe, admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from('app_settings').select('value').eq('key', 'stripe_portal_configuration_id').maybeSingle();
  const saved = typeof data?.value === 'string' ? data.value : null;
  if (saved) return saved;

  const { data: plans } = await admin.from('plans').select('stripe_price_id').in('code', ['standard', 'premium']).not('stripe_price_id', 'is', null);
  const products = new Map<string, string[]>();
  for (const p of plans ?? []) {
    const price = await stripe.prices.retrieve(p.stripe_price_id);
    const product = typeof price.product === 'string' ? price.product : price.product.id;
    products.set(product, [...(products.get(product) ?? []), price.id]);
  }
  const conf = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Hana-Hana 会員プラン / 회원 플랜' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'unused', 'switched_service', 'other'] } },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: [...products.entries()].map(([product, prices]) => ({ product, prices })),
      },
    },
  });
  await admin.from('app_settings').upsert({ key: 'stripe_portal_configuration_id', value: conf.id });
  return conf.id;
}

export type { Stripe };
