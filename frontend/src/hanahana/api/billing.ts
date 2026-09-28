import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type { PlanTier } from './plans';

export type BillingErrorCode =
  | 'unauthorized'
  | 'invalid_plan'
  | 'origin_not_allowed'
  | 'account_not_active'
  | 'plan_not_purchasable'
  | 'already_subscribed'
  | 'stripe_not_configured'
  | 'network';

const KNOWN = new Set<BillingErrorCode>([
  'unauthorized', 'invalid_plan', 'origin_not_allowed', 'account_not_active',
  'plan_not_purchasable', 'already_subscribed', 'stripe_not_configured',
]);

export class BillingError extends Error {
  code: BillingErrorCode;
  constructor(code: BillingErrorCode) {
    super(code);
    this.code = code;
  }
}

export interface BillingPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  refunded_amount: number;
  failure_message: string | null;
}

export interface BillingSubscription {
  id: string;
  plan_code: string;
  plan_tier: PlanTier | null;
  price_jpy: number;
  status: Database['public']['Enums']['subscription_status_t'];
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  latest_invoice_status: string | null;
  is_stripe: boolean;
}

export interface Billing {
  tier: PlanTier;
  mode: string | null;
  has_customer: boolean;
  subscription: BillingSubscription | null;
  payments: BillingPayment[];
}

export async function fetchMyBilling(): Promise<Billing> {
  const { data, error } = await getSupabase().rpc('my_billing');
  if (error) throw error;
  return data as unknown as Billing;
}

async function invoke(fn: 'stripe-checkout' | 'stripe-portal', body: Record<string, string>): Promise<{ url: string; portal?: boolean }> {
  const { data, error } = await getSupabase().functions.invoke<{ url: string; portal?: boolean }>(fn, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const j: unknown = await error.context.json().catch(() => null);
      if (j && typeof j === 'object' && 'error' in j) {
        const code = (j as { error: string }).error;
        if (KNOWN.has(code as BillingErrorCode)) throw new BillingError(code as BillingErrorCode);
      }
    }
    throw new BillingError('network');
  }
  if (!data?.url) throw new BillingError('network');
  return data;
}

/** Stripe Checkout (新規購入) または Billing Portal (プラン変更) の URL を取得 */
export function startCheckout(planCode: 'standard' | 'premium') {
  return invoke('stripe-checkout', { plan_code: planCode, origin: window.location.origin });
}

/** Billing Portal (支払い方法・解約・請求履歴) の URL を取得 */
export function openPortal(flow?: 'cancel' | 'payment_method') {
  return invoke('stripe-portal', { origin: window.location.origin, ...(flow ? { flow } : {}) });
}
