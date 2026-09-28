// Edge Function: stripe-checkout (テストモード)
//   POST { plan_code: 'standard'|'premium', origin }
//   有効な Stripe 契約が無い会員 → Checkout Session を作成し { url } を返す
//   既に Stripe 契約がある会員     → プラン変更は Billing Portal (比例配分) へ誘導 { url, portal: true }
// 価格は plans.stripe_price_id (DB) から取得。ブラウザから price_id は受け取らない。
import { adminClient, allowedOrigin, cors, ensureCustomer, fail, json, portalConfiguration, requireUser, stripeClient } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');

  const user = await requireUser(req);
  if (!user) return fail(401, 'unauthorized');

  let body: { plan_code?: string; origin?: string };
  try { body = await req.json(); } catch { return fail(400, 'invalid_json'); }
  if (body.plan_code !== 'standard' && body.plan_code !== 'premium') return fail(400, 'invalid_plan');

  const admin = adminClient();
  const origin = await allowedOrigin(admin, body.origin);
  if (!origin) return fail(400, 'origin_not_allowed');

  const { data: prof } = await admin.from('profiles').select('status').eq('id', user.uid).maybeSingle();
  if (!prof || prof.status !== 'active') return fail(403, 'account_not_active');

  const { data: plan } = await admin.from('plans').select('id, code, tier, stripe_price_id, is_active').eq('code', body.plan_code).maybeSingle();
  if (!plan?.is_active || !plan.stripe_price_id) return fail(409, 'plan_not_purchasable');

  let stripe;
  try { stripe = stripeClient(); } catch (e) { return fail(500, 'stripe_not_configured', { detail: String(e) }); }

  const customer = await ensureCustomer(stripe, admin, user.uid, user.email);

  // 既存の Stripe 契約があれば Checkout ではなく Portal で変更 (二重契約を防ぐ)
  const { data: existing } = await admin.from('subscriptions')
    .select('id, stripe_subscription_id, status, stripe_price_id')
    .eq('user_id', user.uid).not('stripe_subscription_id', 'is', null)
    .in('status', ['trialing', 'active', 'past_due', 'incomplete']).limit(1).maybeSingle();
  if (existing?.stripe_subscription_id) {
    if (existing.stripe_price_id === plan.stripe_price_id) return fail(409, 'already_subscribed');
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      configuration: await portalConfiguration(stripe, admin),
      return_url: `${origin}/app/plans/manage`,
      flow_data: {
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: existing.stripe_subscription_id,
          items: [{ id: (await stripe.subscriptions.retrieve(existing.stripe_subscription_id)).items.data[0].id, price: plan.stripe_price_id, quantity: 1 }],
        },
        after_completion: { type: 'redirect', redirect: { return_url: `${origin}/app/plans/manage?changed=1` } },
      },
    });
    return json(200, { url: portal.url, portal: true });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${origin}/app/plans/manage?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app/plans?checkout=cancel`,
    locale: 'auto',
    adaptive_pricing: { enabled: false },
    allow_promotion_codes: false,
    client_reference_id: user.uid,
    metadata: { user_id: user.uid, plan_code: plan.code },
    subscription_data: { metadata: { user_id: user.uid, plan_code: plan.code } },
  });
  return json(200, { url: session.url, portal: false });
});
