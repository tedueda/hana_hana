// Edge Function: stripe-portal (テストモード)
//   POST { origin, flow?: 'cancel' | 'payment_method' }
//   Stripe Billing Portal セッションを作成し { url } を返す。
//   Portal 設定 (プラン変更 standard⇄premium・解約・支払い方法・請求履歴) は初回に API で作成し
//   app_settings.stripe_portal_configuration_id に保存する。
import { adminClient, allowedOrigin, cors, ensureCustomer, fail, json, portalConfiguration, requireUser, stripeClient, type Stripe } from '../_shared/stripe.ts';

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
