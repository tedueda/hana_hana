# 本番公開前に上田が決定すべき事項（料金・上限・イベント・運営）

すべて現在の値は「仮置き」。★は `app_settings` / `plans` の値変更のみで反映（デプロイ不要）。

## 1. 価格・プラン

| 項目 | 現在の値 | 変更方法 |
|---|---|---|
| 女性会員 | 全機能無料（課金対象外） | ★ `free_full_access_genders`（既定 `["female"]`。`[]` で全員課金対象） |
| 男性ライト月額 | ¥1,000（税込） | `plans.price_jpy` + Stripe Price `hanahana_light_monthly`（テストモード） |
| 男性スタンダード月額 | ¥2,980（税込） | `plans.price_jpy` + Stripe Price `hanahana_standard_v2_monthly`（テストモード） |
| 招待特典で付与するプラン | light | ★ `invited_tier` |
| 追加ポイント（1pt=¥10）の単価・購入単位 | 未実装（次 PR） | 提案書: 追加いいね 1pt / 写真閲覧 2〜3pt / メッセージ付きいいね 5pt / 特別アプローチ 10〜20pt / 翻訳付き送信 +1pt / 掲示板上位 10pt / 優先表示 20pt |
| イベント参加費の目安 | 男性 ¥3,000〜5,000 / 女性 ¥0〜1,500 | ★ `event_price_guidance` |
| 支払い遅延の猶予日数 | 7 日 | ★ `past_due_grace_days` |
| 年払い・キャンペーン価格の有無 | なし | P3 で Stripe Price 追加 |
| 返金ポリシー（日割り / 不可） | 未定 | P3 実装前に決定（Stripe 設定・利用規約に反映） |

## 2. 利用上限（★ `plan_limits`）

女性会員（課金対象外）はすべて無制限。以下は男性会員の値（`0`=利用不可、`null`=無制限）。

| 上限 | 無料 | ライト | スタンダード |
|---|---:|---:|---:|
| いいね / 日 | 3 | — | — |
| いいね / 月 | — | 30 | 100 |
| メッセージ / 月 | 0（送信不可） | 10 | 無制限 |
| AI 翻訳 / 日 | 2 | 5 | 30 |
| 相手の写真閲覧（未マッチ時） | 1 枚 | 3 枚 | 無制限 (`plans.features.photo_view_max`) |
| 本人確認済みで絞り込み | × | × | ○ (`plans.features.verified_search`) |
| 共通: メッセージ / 分 | 20 | ← | ← (★ `message_rate_per_minute`) |
| サロン投稿 / 日 | 5 (★ `salon_post_per_day`) | | |
| 集計タイムゾーン | Asia/Tokyo (★ `usage_timezone`) | | |

## 3. プレミアム機能パラメータ

| 項目 | 現在 | 変更方法 |
|---|---|---|
| 優先表示の加点 | 15 点 | ★ `priority_boost_score`（0 で無効） |
| 足あとの保持日数 | 30 日 | ★ `footprints_days` |
| スタンダードに含める機能 | footprints / priority / compatibility / profile_polish / verified_search / 割引 / 先行受付 | `plans.features`（ライトに一部付与も可） |
| 添削・翻訳補助の AI プロバイダーとキー | OpenAI gpt-4o-mini（開発用キー） | Supabase Secrets `OPENAI_API_KEY` を事業者キーへ差替 |
| 添削・翻訳補助の回数上限 | なし（翻訳枠とは別） | 必要なら `plan_limits` に追加実装 |

## 4. イベント

| 項目 | 現在 | 変更方法 |
|---|---|---|
| スタンダード割引率 | 20% | `plans.features.event_discount_pct` |
| 先行受付時間 | 48 時間 | ★ `event_early_access_hours`（イベント個別上書き可） |
| ライトの割引・先行受付 | なし | `plans.features` |
| 参加費の決済方法 | 未実装（当日/別途案内） | Stripe Checkout（単発決済）を P3 以降で追加するか判断 |
| キャンセル期限・返金 | 開始前ならキャンセル可・返金規定なし | 規約と `cancel_event_registration` の条件 |

## 5. 運営条件

| 項目 | 現在 | 備考 |
|---|---|---|
| 本人確認バッジ | 審査結果のみ（課金と無関係） | 審査基準・必要書類の確定 |
| 写真必須の猶予 | 既存会員 2026-10-27 まで | ★ `photo_grace_until` |
| 見送り再表示 / 新規参加の日数 | 7 日 / 14 日 | ★ `pass_cooldown_days` / `new_member_days` |
| サロン運営体制 | 通報キュー→非表示/復帰/削除 | 対応 SLA・禁止事項の文言 |
| 本番 SMTP | Supabase 内蔵メーラー | 独自ドメインの送信元へ切替 |
| super_admin | テスト用 e2e-admin | 実運用アカウントの登録、テストアカウント削除 |
| 特定商取引法表記・利用規約の課金条項 | 未作成 | Stripe 本番有効化の前提 |
| Stripe 本番有効化 | しない（テストモードのみ） | 上田の判断で切替 |
