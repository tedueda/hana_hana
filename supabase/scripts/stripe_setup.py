#!/usr/bin/env python3
"""Stripe テストモードの初期設定 (冪等)。

  1. Product/Price (lookup_key: hanahana_light_monthly / hanahana_standard_v2_monthly, JPY 月額) を作成または再利用
     旧価格 (hanahana_standard_monthly ¥500 / hanahana_premium_monthly ¥980) は active=false にする
  2. plans.stripe_price_id を更新 (Supabase Management API)
  3. Webhook エンドポイント (<SUPABASE_URL>/functions/v1/stripe-webhook) を作成または再利用
  4. Edge Function Secrets に STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET を保存 (値は出力しない)

必要な環境変数: STRIPE_SECRET_KEY (sk_test_ のみ), SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
本番キー (sk_live_) が渡された場合は何もせず終了する。
"""
import json
import os
import sys
import urllib.parse
import urllib.request

STRIPE_KEY = os.environ["STRIPE_SECRET_KEY"]
if not STRIPE_KEY.startswith("sk_test_"):
    sys.exit("STRIPE_SECRET_KEY はテストモード (sk_test_) のみ許可します")
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
REF = os.environ["SUPABASE_PROJECT_REF"]
WEBHOOK_URL = f"https://{REF}.supabase.co/functions/v1/stripe-webhook"
EVENTS = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
    "charge.refunded",
]
PLANS = {
    "light": {"lookup_key": "hanahana_light_monthly", "name": "Hana-Hana ライト / 라이트", "amount": 1000},
    "standard": {"lookup_key": "hanahana_standard_v2_monthly", "name": "Hana-Hana スタンダード / 스탠다드", "amount": 2980},
}
LEGACY_LOOKUP_KEYS = ["hanahana_standard_monthly", "hanahana_premium_monthly"]


def stripe(method, path, data=None):
    body = urllib.parse.urlencode(data, doseq=True).encode() if data is not None else None
    req = urllib.request.Request(f"https://api.stripe.com/v1{path}", data=body, method=method,
                                 headers={"Authorization": f"Bearer {STRIPE_KEY}"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"stripe {method} {path}: {e.read().decode()}")


def supabase(method, path, data):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}{path}", data=json.dumps(data).encode(),
                                 method=method, headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"supabase {method} {path}: {e.read().decode()}")


def sql(q):
    return supabase("POST", "/database/query", {"query": q})


# 1. Product / Price
price_ids = {}
for code, p in PLANS.items():
    found = stripe("GET", f"/prices?lookup_keys[]={p['lookup_key']}&active=true&limit=1")["data"]
    if found:
        price = found[0]
        assert price["unit_amount"] == p["amount"] and price["currency"] == "jpy", f"{code}: 既存 Price の金額が計画と異なります"
    else:
        product = stripe("POST", "/products", {"name": p["name"], "metadata[plan_code]": code})
        price = stripe("POST", "/prices", {
            "product": product["id"], "currency": "jpy", "unit_amount": p["amount"],
            "recurring[interval]": "month", "lookup_key": p["lookup_key"], "metadata[plan_code]": code,
        })
    price_ids[code] = price["id"]
    print(f"{code}: price {price['id']} ¥{price['unit_amount']}/month (product {price['product']})")

for key in LEGACY_LOOKUP_KEYS:
    for price in stripe("GET", f"/prices?lookup_keys[]={key}&active=true&limit=10")["data"]:
        stripe("POST", f"/prices/{price['id']}", {"active": "false"})
        print(f"legacy price archived {price['id']} ({key})")

# 2. plans.stripe_price_id (旧価格に紐づくテスト契約は即時解約し、Portal 設定は新価格で再作成させる)
for code, pid in price_ids.items():
    sql(f"update plans set stripe_price_id = '{pid}' where code = '{code}';")
print("plans.stripe_price_id updated")
new_ids = set(price_ids.values())
for sub in stripe("GET", "/subscriptions?status=all&limit=100")["data"]:
    if sub["status"] in ("canceled", "incomplete_expired"):
        continue
    if all(item["price"]["id"] in new_ids for item in sub["items"]["data"]):
        continue
    stripe("DELETE", f"/subscriptions/{sub['id']}")
    print(f"legacy subscription canceled {sub['id']}")
sql("delete from app_settings where key = 'stripe_portal_configuration_id';")

# 3. Webhook endpoint
endpoints = stripe("GET", "/webhook_endpoints?limit=100")["data"]
ep = next((e for e in endpoints if e["url"] == WEBHOOK_URL), None)
secret = None
if ep:
    stripe("POST", f"/webhook_endpoints/{ep['id']}", {"enabled_events[]": EVENTS, "disabled": "false"})
    print(f"webhook endpoint reused {ep['id']} (署名シークレットは新規作成時のみ取得可。再設定が必要なら削除して再実行)")
else:
    ep = stripe("POST", "/webhook_endpoints", {"url": WEBHOOK_URL, "enabled_events[]": EVENTS, "description": "Hana-Hana (test)"})
    secret = ep["secret"]
    print(f"webhook endpoint created {ep['id']}")

# 4. Edge Function secrets
secrets = [{"name": "STRIPE_SECRET_KEY", "value": STRIPE_KEY}]
if secret:
    secrets.append({"name": "STRIPE_WEBHOOK_SECRET", "value": secret})
supabase("POST", "/secrets", secrets)
print("edge function secrets set:", ", ".join(s["name"] for s in secrets))
