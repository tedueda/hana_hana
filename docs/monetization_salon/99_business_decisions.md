# 本番公開前に上田が決定すべき事項（料金・上限・イベント・運営）

すべて現在の値は「仮置き」。★は `app_settings` / `plans` の値変更のみで反映（デプロイ不要）。

## 1. 価格・プラン

| 項目 | 現在の値 | 変更方法 |
|---|---|---|
| スタンダード月額 | ¥500（税込） | `plans.price_jpy`（+ P3 で Stripe Price 作成） |
| プレミアム月額 | ¥980（税込） | 同上 |
| 招待特典で付与するプラン | standard | ★ `invited_tier` |
| 支払い遅延の猶予日数 | 7 日 | ★ `past_due_grace_days` |
| 年払い・キャンペーン価格の有無 | なし | P3 で Stripe Price 追加 |
| 返金ポリシー（日割り / 不可） | 未定 | P3 実装前に決定（Stripe 設定・利用規約に反映） |

## 2. 利用上限（★ `plan_limits`）

| 上限 | 無料 | スタンダード | プレミアム |
|---|---:|---:|---:|
| いいね / 日 | 10 | 50 | 100 |
| メッセージ / 月 | 10 | 100 | 無制限 |
| AI 翻訳 / 日 | 2 | 10 | 50 |
| 共通: メッセージ / 分 | 20 | ← | ← (★ `message_rate_per_minute`) |
| サロン投稿 / 日 | 5 (★ `salon_post_per_day`) | | |
| 集計タイムゾーン | Asia/Tokyo (★ `usage_timezone`) | | |

## 3. プレミアム機能パラメータ

| 項目 | 現在 | 変更方法 |
|---|---|---|
| 優先表示の加点 | 15 点 | ★ `priority_boost_score`（0 で無効） |
| 足あとの保持日数 | 30 日 | ★ `footprints_days` |
| プレミアムに含める機能 | footprints / priority / compatibility / profile_polish / 割引 / 先行受付 | `plans.features`（スタンダードに一部付与も可） |
| 添削・翻訳補助の AI プロバイダーとキー | OpenAI gpt-4o-mini（開発用キー） | Supabase Secrets `OPENAI_API_KEY` を事業者キーへ差替 |
| 添削・翻訳補助の回数上限 | なし（翻訳枠とは別） | 必要なら `plan_limits` に追加実装 |

## 4. イベント

| 項目 | 現在 | 変更方法 |
|---|---|---|
| プレミアム割引率 | 20% | `plans.features.event_discount_pct` |
| 先行受付時間 | 48 時間 | ★ `event_early_access_hours`（イベント個別上書き可） |
| スタンダードの割引・先行受付 | なし | `plans.features` |
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
