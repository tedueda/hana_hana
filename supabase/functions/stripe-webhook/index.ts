// Edge Function: stripe-webhook (テストモード) — verify_jwt=false でデプロイし、Stripe 署名で認証する
//   署名検証: STRIPE_WEBHOOK_SECRET (whsec_...)
//   冪等性  : stripe_events (event.id 主キー)。既処理イベントは 200 {duplicate:true} で無視
//   同期対象: checkout.session.completed / customer.subscription.created|updated|deleted
//             invoice.paid / invoice.payment_failed / charge.refunded
//   DB 書込は service_role 専用 RPC (stripe_*) 経由
import { adminClient, fail, json, stripeClient, type Stripe } from '../_shared/stripe.ts';
import StripeSdk from 'npm:stripe@17.7.0';

const ts = (sec: number | null | undefined) => (sec ? new Date(sec * 1000).toISOString() : null);

async function syncSubscription(admin: ReturnType<typeof adminClient>, sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const invoice = sub.latest_invoice;
  const invoiceStatus = invoice && typeof invoice !== 'string' ? invoice.status : null;
  const { error } = await admin.rpc('stripe_sync_subscription', {
    p_user: sub.metadata?.user_id || null,
    p_customer: customer,
    p_subscription: sub.id,
    p_price: item?.price.id ?? null,
    p_status: sub.status,
    p_period_start: ts(sub.current_period_start),
    p_period_end: ts(sub.current_period_end),
    p_cancel_at_period_end: sub.cancel_at_period_end,
    p_canceled_at: ts(sub.canceled_at),
    p_latest_invoice_status: invoiceStatus,
    p_livemode: sub.livemode,
  });
  if (error) throw new Error(`stripe_sync_subscription: ${error.message}`);
}

function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const direct = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
  if (typeof direct === 'string') return direct;
  if (direct && typeof direct === 'object') return direct.id;
  const parent = (inv as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }).parent;
  const s = parent?.subscription_details?.subscription;
  return typeof s === 'string' ? s : s?.id ?? null;
}

async function recordInvoice(admin: ReturnType<typeof adminClient>, inv: Stripe.Invoice, status: string, failureMessage: string | null) {
  const customer = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
  const pi = (inv as unknown as { payment_intent?: string | { id: string } | null }).payment_intent;
  const charge = (inv as unknown as { charge?: string | { id: string } | null }).charge;
  const { error } = await admin.rpc('stripe_record_payment', {
    p_customer: customer,
    p_subscription: invoiceSubscriptionId(inv),
    p_invoice: inv.id,
    p_payment_intent: typeof pi === 'string' ? pi : pi?.id ?? null,
    p_charge: typeof charge === 'string' ? charge : charge?.id ?? null,
    p_amount: inv.amount_due,
    p_currency: inv.currency,
    p_status: status,
    p_paid_at: status === 'paid' ? ts(inv.status_transitions?.paid_at) ?? new Date().toISOString() : null,
    p_failure_message: failureMessage,
  });
  if (error) throw new Error(`stripe_record_payment: ${error.message}`);
}

async function handle(stripe: Stripe, admin: ReturnType<typeof adminClient>, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.subscription) {
        const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(id, { expand: ['latest_invoice'] });
        await syncSubscription(admin, sub);
      }
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(admin, event.data.object);
      return;
    case 'invoice.paid': {
      const inv = event.data.object;
      await recordInvoice(admin, inv, 'paid', null);
      const subId = invoiceSubscriptionId(inv);
      if (subId) await syncSubscription(admin, await stripe.subscriptions.retrieve(subId));
      return;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object;
      const pi = (inv as unknown as { payment_intent?: string | null }).payment_intent;
      let msg: string | null = null;
      if (typeof pi === 'string') {
        const intent = await stripe.paymentIntents.retrieve(pi);
        msg = intent.last_payment_error?.message ?? intent.last_payment_error?.decline_code ?? null;
      }
      await recordInvoice(admin, inv, 'failed', msg);
      const subId = invoiceSubscriptionId(inv);
      if (subId) await syncSubscription(admin, await stripe.subscriptions.retrieve(subId));
      return;
    }
    case 'charge.refunded': {
      const ch = event.data.object;
      const { error } = await admin.rpc('stripe_record_refund', {
        p_charge: ch.id,
        p_payment_intent: typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id ?? null,
        p_refunded_amount: ch.amount_refunded,
        p_refunded_at: new Date().toISOString(),
      });
      if (error) throw new Error(`stripe_record_refund: ${error.message}`);
      return;
    }
    default:
      return; // 未対応イベントは記録のみ
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return fail(500, 'webhook_not_configured');
  const sig = req.headers.get('stripe-signature');
  if (!sig) return fail(400, 'missing_signature');

  let stripe: Stripe;
  try { stripe = stripeClient(); } catch (e) { return fail(500, 'stripe_not_configured', { detail: String(e) }); }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret, undefined, StripeSdk.createSubtleCryptoProvider());
  } catch (e) {
    return fail(400, 'invalid_signature', { detail: String(e) });
  }
  if (event.livemode) return fail(400, 'livemode_rejected');

  const admin = adminClient();
  const { data: fresh, error: beginErr } = await admin.rpc('stripe_begin_event', {
    p_id: event.id, p_type: event.type, p_livemode: event.livemode, p_payload: event as unknown as Record<string, unknown>,
  });
  if (beginErr) return fail(500, 'event_store_failed', { detail: beginErr.message });
  if (fresh !== true) return json(200, { received: true, duplicate: true, id: event.id });

  try {
    await handle(stripe, admin, event);
    await admin.rpc('stripe_finish_event', { p_id: event.id, p_error: null });
    return json(200, { received: true, id: event.id, type: event.type });
  } catch (e) {
    await admin.rpc('stripe_finish_event', { p_id: event.id, p_error: String(e) });
    return fail(500, 'handler_failed', { detail: String(e) });
  }
});
