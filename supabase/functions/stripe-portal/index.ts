// Edge Function: stripe-portal (テストモード)
//   POST { origin, flow?: 'cancel' | 'payment_method' }
//   Stripe Billing Portal セッションを作成し { url } を返す。
//   Portal 設定 (プラン変更 standard⇄premium・解約・支払い方法・請求履歴) は初回に API で作成し
//   app_settings.stripe_portal_configuration_id に保存する。
import { adminClient, allowedOrigin, cors, ensureCustomer, fail, json, requireUser, stripeClient, type Stripe } from '../_shared/stripe.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

async function portalConfiguration(stripe: Stripe, admin: SupabaseClient): Promise<string> {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');

  const user = await requireUser(req);
  if (!user) return fail(401, 'unauthorized');

  let body: { origin?: string; flow?: string };
  try { body = await req.json(); } catch { body = {}; }

  const admin = adminClient();
  const origin = await allowedOrigin(admin, body.origin);
  if (!origin) return fail(400, 'origin_not_allowed');

  let stripe: Stripe;
  try { stripe = stripeClient(); } catch (e) { return fail(500, 'stripe_not_configured', { detail: String(e) }); }

  const customer = await ensureCustomer(stripe, admin, user.uid, user.email);
  const configuration = await portalConfiguration(stripe, admin);

  const { data: sub } = await admin.from('subscriptions').select('stripe_subscription_id')
    .eq('user_id', user.uid).not('stripe_subscription_id', 'is', null)
    .in('status', ['trialing', 'active', 'past_due']).limit(1).maybeSingle();

  let flow_data: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined;
  if (body.flow === 'cancel' && sub?.stripe_subscription_id) {
    flow_data = { type: 'subscription_cancel', subscription_cancel: { subscription: sub.stripe_subscription_id } };
  } else if (body.flow === 'payment_method') {
    flow_data = { type: 'payment_method_update' };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer, configuration, return_url: `${origin}/app/plans/manage`, locale: 'auto', flow_data,
  });
  return json(200, { url: session.url });
});
