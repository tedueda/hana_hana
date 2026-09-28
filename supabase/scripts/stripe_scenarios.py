#!/usr/bin/env python3
"""Stripe テストモードの実シナリオ検証 (購入/更新/プラン変更/決済失敗/解約/返金/Webhook 冪等)。

Stripe API で契約を操作し、実際に Stripe → stripe-webhook (Supabase Edge Function) へ届いた
Webhook の結果を my_billing() / stripe_events で確認する。

必要な環境変数: STRIPE_SECRET_KEY (sk_test_ のみ), SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
    テストユーザー: SCENARIO_USER_A (Checkout 経路), SCENARIO_USER_B (Test Clock 経路), SCENARIO_PASSWORD
"""
import hashlib
import hmac
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

STRIPE_KEY = os.environ["STRIPE_SECRET_KEY"]
if not STRIPE_KEY.startswith("sk_test_"):
    sys.exit("STRIPE_SECRET_KEY はテストモード (sk_test_) のみ許可します")
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
REF = os.environ["SUPABASE_PROJECT_REF"]
BASE = f"https://{REF}.supabase.co"
USER_A = os.environ.get("SCENARIO_USER_A", "e2e-jp1@hanahana.test")
USER_B = os.environ.get("SCENARIO_USER_B", "e2e-kr1@hanahana.test")
PASSWORD = os.environ["SCENARIO_PASSWORD"]
ORIGIN = "https://hana-hana.netlify.app"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok)))
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail}")


def http(url, method="GET", data=None, headers=None, form=False):
    if isinstance(data, str):
        body = data.encode()
    elif data is not None:
        body = urllib.parse.urlencode(data, doseq=True).encode() if form else json.dumps(data).encode()
    else:
        body = None
    h = dict(headers or {})
    if data is not None and not form:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def stripe(method, path, data=None):
    code, body = http(f"https://api.stripe.com/v1{path}", method, data, {"Authorization": f"Bearer {STRIPE_KEY}"}, form=True)
    if code >= 400:
        sys.exit(f"stripe {method} {path}: {body}")
    return body


def mgmt(method, path, data=None):
    code, body = http(f"https://api.supabase.com/v1/projects/{REF}{path}", method, data, {"Authorization": f"Bearer {TOKEN}"})
    if code >= 400:
        sys.exit(f"supabase {method} {path}: {body}")
    return body


def sql(q):
    return mgmt("POST", "/database/query", {"query": q})


keys = {k["name"]: k["api_key"] for k in mgmt("GET", "/api-keys")}
ANON = keys["anon"]
WEBHOOK_SECRET = next(s["value"] for s in mgmt("GET", "/secrets") if s["name"] == "STRIPE_WEBHOOK_SECRET")


def sign_in(email):
    code, body = http(f"{BASE}/auth/v1/token?grant_type=password", "POST", {"email": email, "password": PASSWORD}, {"apikey": ANON})
    if code != 200:
        sys.exit(f"sign in failed for {email}: {body}")
    return body["access_token"], body["user"]["id"]


def rpc(jwt, name, args=None):
    return http(f"{BASE}/rest/v1/rpc/{name}", "POST", args or {}, {"apikey": ANON, "Authorization": f"Bearer {jwt}"})


def fn(jwt, name, payload):
    return http(f"{BASE}/functions/v1/{name}", "POST", payload, {"apikey": ANON, "Authorization": f"Bearer {jwt}"})


def wait_billing(jwt, pred, timeout=40):
    deadline = time.time() + timeout
    b = None
    while time.time() < deadline:
        _, b = rpc(jwt, "my_billing")
        if pred(b):
            return b
        time.sleep(2)
    return b


def events_for(obj_id):
    rows = sql(f"select id, type, processed_at is not null as done, error from stripe_events where payload::text like '%{obj_id}%' order by received_at")
    return rows


def reset_user(uid):
    """既存の Stripe 契約と DB 状態を掃除する (テスト用ユーザー限定)。"""
    rows = sql(f"select stripe_customer_id from billing_customers where user_id = '{uid}'")
    for r in rows:
        for s in stripe("GET", f"/subscriptions?customer={r['stripe_customer_id']}&status=all&limit=100")["data"]:
            if s["status"] not in ("canceled", "incomplete_expired"):
                stripe("DELETE", f"/subscriptions/{s['id']}")
    sql(f"delete from payments where user_id = '{uid}'; delete from subscriptions where user_id = '{uid}'; delete from billing_customers where user_id = '{uid}';")


def sub_of(b):
    return (b or {}).get("subscription") or {}


# ---------------------------------------------------------------- 準備
jwt_a, uid_a = sign_in(USER_A)
jwt_b, uid_b = sign_in(USER_B)
for c in stripe("GET", "/test_helpers/test_clocks?limit=100")["data"]:
    if c["name"] == "hanahana-scenario":
        stripe("DELETE", f"/test_helpers/test_clocks/{c['id']}")
reset_user(uid_a)
reset_user(uid_b)
time.sleep(8)
reset_user(uid_a)
reset_user(uid_b)
plans = {r["code"]: r["stripe_price_id"] for r in sql("select code, stripe_price_id from plans where stripe_price_id is not null")}
check("plans.stripe_price_id 設定済 (standard/premium)", set(plans) >= {"standard", "premium"}, str(plans))
for code, amount in (("standard", 500), ("premium", 980)):
    p = stripe("GET", f"/prices/{plans[code]}")
    check(f"Stripe Price {code} = JPY {amount}/month", p["currency"] == "jpy" and p["unit_amount"] == amount and p["recurring"]["interval"] == "month" and not p["livemode"])

# ---------------------------------------------------------------- S0: 認可・入力検証
code, body = http(f"{BASE}/functions/v1/stripe-checkout", "POST", {"plan_code": "standard", "origin": ORIGIN}, {"apikey": ANON})
check("checkout: 未認証は 401", code == 401, str(body))
code, body = fn(jwt_a, "stripe-checkout", {"plan_code": "free", "origin": ORIGIN})
check("checkout: free は購入不可 (400)", code == 400, str(body))
code, body = fn(jwt_a, "stripe-checkout", {"plan_code": "standard", "origin": "https://evil.example"})
check("checkout: 許可外 origin は拒否 (400)", code == 400, str(body))
code, body = http(f"{BASE}/functions/v1/stripe-webhook", "POST", {"id": "evt_x"}, {})
check("webhook: 署名なしは 400", code == 400, str(body))
code, body = http(f"{BASE}/functions/v1/stripe-webhook", "POST", {"id": "evt_x"}, {"stripe-signature": "t=1,v1=deadbeef"})
check("webhook: 不正署名は 400", code == 400, str(body))

# ---------------------------------------------------------------- S1: 購入 (Checkout セッション生成 → 契約作成)
code, body = fn(jwt_a, "stripe-checkout", {"plan_code": "standard", "origin": ORIGIN})
check("checkout: Checkout URL を返す", code == 200 and str(body.get("url", "")).startswith("https://checkout.stripe.com/") and body.get("portal") is False, str(body)[:120])
cust_a = sql(f"select stripe_customer_id from billing_customers where user_id = '{uid_a}'")[0]["stripe_customer_id"]
check("checkout: billing_customers に顧客が保存される", cust_a.startswith("cus_"))
# Checkout 画面のカード入力はブラウザ E2E で別途実施。ここでは同顧客に対しテストカードで契約を作成し Webhook 同期を検証する
pm = stripe("POST", "/payment_methods", {"type": "card", "card[token]": "tok_visa"})
stripe("POST", f"/payment_methods/{pm['id']}/attach", {"customer": cust_a})
stripe("POST", f"/customers/{cust_a}", {"invoice_settings[default_payment_method]": pm["id"]})
sub_a = stripe("POST", "/subscriptions", {"customer": cust_a, "items[0][price]": plans["standard"], "metadata[user_id]": uid_a, "metadata[plan_code]": "standard"})
b = wait_billing(jwt_a, lambda x: sub_of(x).get("status") == "active" and sub_of(x).get("plan_code") == "standard" and any(p["status"] == "paid" for p in x.get("payments", [])))
check("S1 購入: my_billing が standard/active + 支払 paid ¥500", sub_of(b).get("plan_code") == "standard" and sub_of(b).get("status") == "active" and any(p["status"] == "paid" and p["amount"] == 500 for p in b.get("payments", [])), json.dumps(b, ensure_ascii=False)[:300])
check("S1 購入: tier = standard", b.get("tier") == "standard")
code, body = fn(jwt_a, "stripe-checkout", {"plan_code": "standard", "origin": ORIGIN})
check("checkout: 同一プラン再購入は 409 already_subscribed", code == 409, str(body))
code, body = fn(jwt_a, "stripe-checkout", {"plan_code": "premium", "origin": ORIGIN})
check("checkout: 契約中のプラン変更は Billing Portal へ誘導", code == 200 and body.get("portal") is True and str(body.get("url", "")).startswith("https://billing.stripe.com/"), str(body)[:120])
code, body = fn(jwt_a, "stripe-portal", {"origin": ORIGIN, "flow": "cancel"})
check("portal: 解約フローの URL を返す", code == 200 and str(body.get("url", "")).startswith("https://billing.stripe.com/"), str(body)[:120])

# ---------------------------------------------------------------- S2: プラン変更 standard → premium (Portal と同じ比例配分更新)
item = sub_a["items"]["data"][0]["id"]
stripe("POST", f"/subscriptions/{sub_a['id']}", {"items[0][id]": item, "items[0][price]": plans["premium"], "proration_behavior": "create_prorations"})
b = wait_billing(jwt_a, lambda x: sub_of(x).get("plan_code") == "premium")
check("S2 変更: standard → premium が同期 (tier=premium)", sub_of(b).get("plan_code") == "premium" and b.get("tier") == "premium", json.dumps(sub_of(b), ensure_ascii=False)[:200])

# ---------------------------------------------------------------- S3: プラン変更 premium → standard
stripe("POST", f"/subscriptions/{sub_a['id']}", {"items[0][id]": item, "items[0][price]": plans["standard"], "proration_behavior": "create_prorations"})
b = wait_billing(jwt_a, lambda x: sub_of(x).get("plan_code") == "standard")
check("S3 変更: premium → standard が同期", sub_of(b).get("plan_code") == "standard" and b.get("tier") == "standard")

# ---------------------------------------------------------------- S6: 返金 (部分 → 全額)
paid = sql(f"select id, stripe_invoice_id, stripe_payment_intent_id from payments where user_id = '{uid_a}' and status = 'paid' and amount = 500 limit 1")[0]
pi_id = paid["stripe_payment_intent_id"] or stripe("GET", f"/invoices/{paid['stripe_invoice_id']}/payments")["data"][0]["payment"]["payment_intent"]
stripe("POST", "/refunds", {"payment_intent": pi_id, "amount": 200})
b = wait_billing(jwt_a, lambda x: any(p["id"] == paid["id"] and p["refunded_amount"] == 200 for p in x.get("payments", [])))
p = next(p for p in b["payments"] if p["id"] == paid["id"])
check("S6 返金: 部分返金 ¥200 → partially_refunded", p["refunded_amount"] == 200 and p["status"] == "partially_refunded", json.dumps(p, ensure_ascii=False))
stripe("POST", "/refunds", {"payment_intent": pi_id})
b = wait_billing(jwt_a, lambda x: any(p["id"] == paid["id"] and p["refunded_amount"] == 500 for p in x.get("payments", [])))
p = next(p for p in b["payments"] if p["id"] == paid["id"])
row = sql(f"select refunded_at from payments where id = '{paid['id']}'")[0]
check("S6 返金: 全額返金 ¥500 → refunded + refunded_at", p["refunded_amount"] == 500 and p["status"] == "refunded" and row["refunded_at"], json.dumps(p, ensure_ascii=False))

# ---------------------------------------------------------------- S5: 解約 (期間末解約 → 即時解約)
stripe("POST", f"/subscriptions/{sub_a['id']}", {"cancel_at_period_end": "true"})
b = wait_billing(jwt_a, lambda x: sub_of(x).get("cancel_at_period_end") is True)
check("S5 解約: 期間末解約フラグが同期 (契約はまだ有効)", sub_of(b).get("cancel_at_period_end") is True and sub_of(b).get("status") == "active" and b.get("tier") == "standard")
stripe("DELETE", f"/subscriptions/{sub_a['id']}")
b = wait_billing(jwt_a, lambda x: not sub_of(x))
check("S5 解約: 即時解約 → subscription なし / tier=free / 支払履歴は保持", not sub_of(b) and b.get("tier") == "free" and len(b.get("payments", [])) >= 1, json.dumps(b, ensure_ascii=False)[:200])
row = sql(f"select status from subscriptions where stripe_subscription_id = '{sub_a['id']}'")[0]
check("S5 解約: subscriptions.status = canceled", row["status"] == "canceled", str(row))

# ---------------------------------------------------------------- S4: 更新 + 決済失敗 (Test Clock)
clock = stripe("POST", "/test_helpers/test_clocks", {"frozen_time": int(time.time()), "name": "hanahana-scenario"})
cust_b = stripe("POST", "/customers", {"email": USER_B, "test_clock": clock["id"], "metadata[user_id]": uid_b})["id"]
sql(f"insert into billing_customers (user_id, stripe_customer_id, livemode) values ('{uid_b}', '{cust_b}', false) on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id")
pm_b = stripe("POST", "/payment_methods", {"type": "card", "card[token]": "tok_visa"})
stripe("POST", f"/payment_methods/{pm_b['id']}/attach", {"customer": cust_b})
stripe("POST", f"/customers/{cust_b}", {"invoice_settings[default_payment_method]": pm_b["id"]})
sub_b = stripe("POST", "/subscriptions", {"customer": cust_b, "items[0][price]": plans["premium"], "metadata[user_id]": uid_b, "metadata[plan_code]": "premium"})
b = wait_billing(jwt_b, lambda x: sub_of(x).get("status") == "active" and any(p["status"] == "paid" for p in x.get("payments", [])))
check("S4 準備: premium 契約 (Test Clock) が active", sub_of(b).get("plan_code") == "premium" and sub_of(b).get("status") == "active")


def period_end(sub):
    return sub.get("current_period_end") or sub["items"]["data"][0]["current_period_end"]


first_end = period_end(sub_b)


def advance(to):
    stripe("POST", f"/test_helpers/test_clocks/{clock['id']}/advance", {"frozen_time": to})
    for _ in range(60):
        time.sleep(3)
        if stripe("GET", f"/test_helpers/test_clocks/{clock['id']}")["status"] == "ready":
            return
    sys.exit("test clock advance timeout")


advance(first_end + 3600)
b = wait_billing(jwt_b, lambda x: len([p for p in x.get("payments", []) if p["status"] == "paid"]) >= 2 and sub_of(x).get("current_period_end") and sub_of(x)["current_period_end"] > time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(first_end)), timeout=90)
paid_b = [p for p in b.get("payments", []) if p["status"] == "paid"]
check("S4 更新: 翌月更新で 2 件目の paid ¥980 と period_end 更新", len(paid_b) >= 2 and all(p["amount"] == 980 for p in paid_b) and sub_of(b).get("status") == "active", json.dumps(b, ensure_ascii=False)[:300])
# 決済失敗: 次回更新前に失敗カードへ差し替え
pm_fail = stripe("POST", "/payment_methods", {"type": "card", "card[token]": "tok_chargeCustomerFail"})
stripe("POST", f"/payment_methods/{pm_fail['id']}/attach", {"customer": cust_b})
stripe("POST", f"/customers/{cust_b}", {"invoice_settings[default_payment_method]": pm_fail["id"]})
second_end = period_end(stripe("GET", f"/subscriptions/{sub_b['id']}"))
advance(second_end + 3600)
b = wait_billing(jwt_b, lambda x: any(p["status"] == "failed" for p in x.get("payments", [])), timeout=90)
failed = [p for p in b.get("payments", []) if p["status"] == "failed"]
check("S4 失敗: invoice.payment_failed → payments.status=failed + 失敗理由", bool(failed) and bool(failed[0].get("failure_message")), json.dumps(failed, ensure_ascii=False)[:300])
check("S4 失敗: 契約は past_due (猶予中は tier 維持)", sub_of(b).get("status") == "past_due" and sub_of(b).get("latest_invoice_status") == "open", json.dumps(sub_of(b), ensure_ascii=False)[:200])

# ---------------------------------------------------------------- S7: Webhook 冪等 (Stripe から同一イベントを実再送)
# 署名は Stripe 側で付与されるため、stripe CLI の `events resend` で本物の再送を行う (Supabase Secrets の値はローカルから取得できない)
ev = stripe("GET", "/events?type=customer.subscription.deleted&limit=1")["data"][0]
before = sql(f"select count(*)::int as n, max(processed_at) as p from stripe_events where id = '{ev['id']}'")[0]
we = next(w for w in stripe("GET", "/webhook_endpoints?limit=20")["data"] if w["url"].endswith("/stripe-webhook"))
cli = shutil.which("stripe") or os.path.expanduser("~/.local/bin/stripe")
resend = subprocess.run([cli, "events", "resend", ev["id"], "--webhook-endpoint", we["id"], "--api-key", STRIPE_KEY, "-c"], capture_output=True, text=True)
check("S7 冪等: stripe events resend が成功", resend.returncode == 0, (resend.stderr or resend.stdout)[-200:])
time.sleep(6)
after = sql(f"select count(*)::int as n, max(processed_at) as p from stripe_events where id = '{ev['id']}'")[0]
check("S7 冪等: 再送後も stripe_events は 1 行・processed_at 不変 (再処理なし)", after["n"] == 1 and after["p"] == before["p"], json.dumps([before, after]))
check("S7 冪等: 再送後も subscriptions.status = canceled のまま", sql(f"select status from subscriptions where stripe_subscription_id = '{ev['data']['object']['id']}'")[0]["status"] == "canceled")
# livemode 拒否は Edge Function が署名検証直後に行う (署名付き偽イベントは作れないためコード上の分岐と DB 状態で確認)
src = open(os.path.join(os.path.dirname(__file__), "..", "functions", "stripe-webhook", "index.ts"), encoding="utf-8").read()
check("S7 安全: webhook は livemode=true を拒否する分岐を持つ", "event.livemode" in src and "livemode_rejected" in src)
check("S7 安全: stripe_events に livemode=true の行がない", sql("select count(*)::int as n from stripe_events where livemode")[0]["n"] == 0)

errs = sql("select id, type, error from stripe_events where error is not null and processed_at is null")
check("Webhook: 処理エラーのイベントなし", len(errs) == 0, json.dumps(errs, ensure_ascii=False)[:300])

# ---------------------------------------------------------------- 後片付け (Test Clock 削除で B の契約は消える)
stripe("DELETE", f"/test_helpers/test_clocks/{clock['id']}")

ok = sum(1 for _, r in results if r)
print(f"\n{ok}/{len(results)} passed")
sys.exit(0 if ok == len(results) else 1)
