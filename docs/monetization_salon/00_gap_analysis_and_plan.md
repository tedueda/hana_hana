# Hana-Hana 料金プラン・交流サロン — 差分表・画面構成・DB変更・PR分割案

計画書「Hana-Hana 料金プラン・交流サロン提案計画書 改訂版1.1（2026-09-28）」への着手時点の確認結果。

## 1. 基準コミットとの差分

| 項目 | 値 |
|---|---|
| 計画書の確認コミット | `9ca00474c9927f7b3a444997e34b0cffc15f6e95` |
| 着手時点の `main` | `9ca00474c9927f7b3a444997e34b0cffc15f6e95` |
| 差分 | **なし** |

計画書 §2 の現状認識（相互いいね／マッチ／1対1チャット／検索・おすすめ／通報・ブロック／日韓UI／翻訳あり、`/app/plus` は案内のみ、`plans`・`subscriptions`・`payments` は列のみで未使用）は現行コードで再確認済み。

## 2. 現行コードと計画書の差分表

### 2.1 課金・会員権限

| 計画書の要件 | 現行 | 追加・変更 | PR |
|---|---|---|---|
| 3プラン（無料／スタンダード500円／プレミアム980円 税込） | `plans(code,name_ja,name_ko,stripe_price_id,interval,is_active)` 空。価格・通貨・機能上限なし | `plans` に `tier`, `price_jpy`, `currency`, `sort_order`, `features jsonb` を追加。3行 seed。**価格・上限はDB値**でコード固定しない | P1 |
| 会員区分の判定 | `profiles.member_tier = free/paid/invited` を `is_paid` に使用 | `plan_tier_t = free/standard/premium` を新設。`current_plan_tier(uid)` = 有効な `subscriptions`（active/trialing/past_due 猶予）→`plans.tier`、なければ `member_tier='invited'` の招待特典（設定 `invited_tier`）→free。`profiles.member_tier` は互換のため残し `paid` は同期更新 | P1 |
| 利用枠（仮置き） | いいね・メッセージは上限なし。翻訳は全員共通 `translation_limits` | `app_settings.plan_limits` jsonb（`{free:{likes_per_day:10,messages_per_month:10,translations_per_day:2}, standard:{50,100,10}, premium:{100,null,50}}`）。`plan_limit(tier,key)` 関数。**サーバー側で判定**: `likes_insert` 前トリガー、`messages_insert` 前トリガー（月間通数）、Edge Function `translate` の日次上限をプラン別に | P1 |
| メッセージ無制限（プレミアム）＋共通の送信速度制限 | なし | `messages_per_month = null` で無制限。全プラン共通 `message_rate_per_minute`（設定）を同トリガーで判定 | P1 |
| 上限到達時も履歴は読める | – | SELECT は無変更。到達時は送信 UI を無効化しアップグレード導線 | P1 |
| 本人確認済み表示は審査結果に基づく | `public_profile.is_verified = verifications.status='verified'`（審査結果） | 変更なし。プラン比較表の文言のみ（会費では表示されない旨を明記） | P1 |
| `/app/plus` 比較・購入・管理 | 案内文のみ | `/app/plans`（比較表・税込価格・更新日・解約方法・利用枠、日韓）、`/app/plans/manage`（現プラン・次回請求日・決済状況・変更・解約・支払い方法） | P1（表示）/ P3（購入） |
| 足あと（プレミアム） | `user_events.event_type='view'` は記録用のみ | `record_profile_view(target)` RPC（同一日は1件、ブロック・非公開は記録しない）、`my_footprints()`（プレミアムのみ返す・非プレミアムは件数のみ）、`/app/profile/footprints` | P2 |
| 優先表示（プレミアム） | `recommend_users` スコアリング | スコアに `priority_boost`（設定値）を加算。理由に「おすすめ会員（有料）」を表示し広告的露出を明示。ブロック・条件・安全制限は不変 | P2 |
| 相性診断（プレミアム） | なし | `compatibility(target)` RPC: 目的／言語（学習⇄母語）／趣味／希望条件の一致から 0–100 と理由配列。`/app/users/:id` に「相性を見る」（プレミアム以外は案内） | P2 |
| プロフィール添削・翻訳補助（プレミアム） | 翻訳 Edge Function（message/draft） | `translate` に `kind='profile_polish'`（自己紹介の添削）と `kind='profile_translate'` を追加。プレミアム判定はサーバー側。結果は本人が確認して反映（自動保存しない） | P2 |
| イベント割引（プレミアム）／優先案内（スタンダード以上） | なし | `events`, `event_registrations`（定員・申込・キャンセル）、`app_settings.event_discount_premium_pct`。イベント一覧で割引後価格と対象を事前表示。優先案内は `events.early_access_hours` | P2 |
| いいね数増加／詳細検索 | 検索は全員同一 | いいね上限はプラン別（上記）。詳細検索は現行の条件シートを全員維持（計画書は差別化を明記していないため設定 `search_advanced_min_tier` で切替可能に、既定 free） | P1 |
| Stripe 購入・更新・変更・失敗・解約・返金 | 列のみ | Edge Functions `stripe-checkout`（Checkout Session）, `stripe-portal`（Billing Portal）, `stripe-webhook`（署名検証・`stripe_events` で重複排除）。同期対象: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`, `charge.refunded`。500⇄980 の変更は Portal（比例配分）。**テストモードのみ**、本番キー未設定 | P3 |
| 運営画面の指標 | `admin_stats` | `admin_plan_stats()`（プラン別会員数・申込・解約・失敗）、`admin_translation_cost()`（文字数・回数）、サロン指標（下記） | S1/P1/P3 |

### 2.2 交流サロン

| 計画書の要件 | 現行 | 追加 | PR |
|---|---|---|---|
| 3テーマ | なし | `salon_categories`（`language_culture`, `travel_food`, `free_talk`、日韓名、並び順、is_active）。追加は管理画面 | S1 |
| 投稿（題・本文・写真1枚・テーマ・原文言語） | なし | `salon_posts`、Storage バケット `salon-photos`（公開読み取り・本人書込） | S1 |
| コメント・リアクション | なし | `salon_comments`, `salon_reactions(post_id,user_id)` | S1 |
| 無料会員も閲覧・投稿・コメント | – | RLS: `is_active_member()` のみ要求。プラン条件なし | S1 |
| 翻訳ボタン・原文常時参照 | `translate` は message/draft のみ | `translate` に `kind='salon_post'/'salon_comment'`（公開コンテンツなので参加者確認は「閲覧可能か＝ブロック関係なし・非表示でない」）。キャッシュ `salon_translations`。利用枠・費用監視は既存 `translation_usage` に kind 追加 | S1 |
| 投稿者→公開プロフィール、DM 禁止 | `/app/users/:id` あり | 投稿・コメントの名前／写真から `/app/users/:id` へ。DM 導線は既存「いいね」のみ（新規経路なし） | S1 |
| 通報・非表示・ブロック・スパム制限・外部誘導検知 | `reports`（user/message）、`blocks` | `reports` に `salon_post_id`, `salon_comment_id` 追加（`report_reason_t` に `spam`, `solicitation`, `personal_info` 追加）。ブロック相手の投稿・コメントは RLS で非表示。投稿上限 `salon_post_per_day` / `salon_comment_per_minute`（設定）。URL・連絡先パターン検知で `flagged=true`＋運営通知（自動削除はしない） | S1 |
| 本人の編集・削除、削除済み非公開 | – | `salon_posts.deleted_at`（ソフト削除）、`is_hidden`（運営）。RLS で `deleted_at is null and not is_hidden` を一般に強制、本人は自分の削除済みを閲覧可 | S1 |
| 運営：非表示・復帰・削除・監査 | `admin_audit_logs`, `admin_log()` | `salon_moderation_actions`、`admin_salon_hide/unhide/delete` RPC、`/app/admin/salon`（通報キュー・投稿一覧・対応） | S1 |
| 通知（返信・リアクション） | `notifications` | `notification_type_t` に `salon_comment`, `salon_reaction` 追加、`after_salon_comment_insert` トリガー | S1 |
| トップの並び（今週の話題・新着・返信あり・参加中） | – | `salon_feed(kind, category, cursor)` RPC。`pinned_until` で運営テーマ固定 | S1 |
| 日韓運営ルール | 規約ページあり | `/app/legal/salon-rules`（ja/ko） | S1 |
| 指標（投稿者・返信率48h・通報） | – | `admin_salon_stats()`、`/app/admin/salon` 上部カード | S1 |
| イベント（手動運営→自動化） | – | P2 で最小版（一覧・申込・定員・キャンセル・通報導線）。自動化は対象外 | P2 |

## 3. 画面構成（スマートフォン 375×812 基準）

```
[会員 AppShell 5タブは維持]  ✨おすすめ  🔍探す  💞マッチ  💬チャット  👤マイ
  ・「探す」上部と「マイ」にサロンカード（未読返信数バッジ）
  ・上部ブランド右に 🔔通知（サロン返信を含む）

/app/salon                     テーマチップ（すべて｜ことば・文化｜旅・グルメ｜フリートーク）
                               並び（新着｜人気｜返信あり｜参加中）｜🔍検索｜[＋投稿]
                               カード: 投稿者(写真・名前・🇯🇵/🇰🇷)・題・本文冒頭・写真・💬件数・♡
/app/salon/new                 テーマ／題／本文／写真1枚／原文言語（自動判定・変更可）→ 投稿
/app/salon/:postId             原文 ⇄ 翻訳（AI翻訳ボタン、原文は常に表示可）、♡、通報、…（編集/削除 or 非表示/通報/ブロック）
                               コメント一覧（各コメントにも翻訳・通報）、下部固定コメント入力
                               投稿者タップ → /app/users/:id（既存。いいね→マッチ→チャットへ）
/app/legal/salon-rules         サロン利用ルール（ja/ko）

/app/plans                     3列比較（無料｜スタンダード ¥500｜プレミアム ¥980 税込/月）
                               各行: 検索・いいね/日・メッセージ/月・AI翻訳/日・本人確認表示・足あと・相性診断・
                               優先表示・サロン・イベント特典・通報等（全員）。更新日・解約方法・注意事項
                               [このプランにする] → Stripe Checkout（テスト）
/app/plans/manage              現プラン・状態・次回請求日・直近の決済・[プラン変更][支払い方法][解約]（Billing Portal）
                               解約予約中の表示（期間満了日まで利用可）
/app/profile/footprints        足あと（プレミアム）: 訪問者・日時。非プレミアムは件数と案内
/app/users/:id                 既存＋「相性を見る」（プレミアム）／「本人確認済み」は審査結果のみ
/app/profile/edit              既存＋「AIで添削」「韓国語/日本語の訳を作る」（プレミアム、確認して反映）
/app/events, /app/events/:id   一覧・詳細・申込/キャンセル（定員）・プレミアム割引後価格・優先案内表示

/app/admin/salon               指標カード（週次投稿者 JP/KR、48h返信率、通報件数）｜通報キュー｜投稿一覧
                               操作: 非表示／復帰／削除／投稿者へ（会員詳細）。理由必須・監査ログ
/app/admin/plans               プラン一覧（価格・上限の編集は app_settings/plans 経由）・会員数・申込/解約/失敗の集計
/app/admin/events              イベント作成・定員・申込者
```

## 4. DB 変更（すべて新規 Migration。既存ファイルは編集しない）

| Migration | 内容 | PR |
|---|---|---|
| `..._001400_salon.sql` | `salon_categories`, `salon_posts`, `salon_comments`, `salon_reactions`, `salon_translations`, `salon_moderation_actions`；`reports` に `salon_post_id`/`salon_comment_id`；enum 追加（report_reason, notification_type）；RLS（閲覧=active会員・非表示/削除除外・ブロック除外、書込=本人、運営=is_admin）；RPC `salon_feed`, `salon_post_detail`, `salon_delete_own`, `admin_salon_*`, `admin_salon_stats`；トリガー（通知・スパム上限・外部誘導フラグ）；Storage `salon-photos`；`app_settings.salon_*` | S1 |
| `..._001500_plans.sql` | `plan_tier_t`；`plans` 列追加＋3行 seed（stripe_price_id は環境ごとに設定）；`subscriptions` に `plan_tier`, `latest_invoice_status`；`current_plan_tier(uid)`, `my_plan()`, `plan_limit()`；`app_settings.plan_limits`, `message_rate_per_minute`, `invited_tier`；いいね／メッセージ上限トリガー；`translation_usage` を残し Edge Function 側でプラン別日次上限；`public_settings()` に plan 情報 | P1 |
| `..._001600_premium.sql` | `profile_views`（足あと）＋ `record_profile_view`, `my_footprints`；`recommend_users` に `priority_boost`；`compatibility(target)`；`events`, `event_registrations` ＋ RLS/RPC；`app_settings.priority_boost_score`, `event_discount_premium_pct`, `event_early_access_hours` | P2 |
| `..._001700_stripe.sql` | `stripe_events`（event_id 主キー、重複排除）；`payments` に `refunded_amount`, `stripe_charge_id`；`sync_subscription_from_stripe()`（service_role 専用）；`admin_plan_stats()` | P3 |

RLS/権限テストは `supabase/tests/rls_smoke_test.sql` に追記（第三者の投稿編集不可、ブロック相手の投稿非表示、非表示投稿の一般不可視、無料会員の上限超過拒否、非プレミアムの足あと不可、subscriptions への authenticated 書込不可、service_role のみ同期 等）。

## 5. PR 分割案と実施順

| PR | 内容 | 検証 |
|---|---|---|
| **S1** サロン | §2.2 全項目（3テーマ・投稿・コメント・リアクション・翻訳・通報・非表示・ブロック・運営画面・通知・日韓・ルール） | RLS テスト、ja/ko スクショ、ブラウザ E2E（投稿→返信→翻訳→通報→運営対応） |
| **P1** 会員プラン基盤 | 3プラン定義・`current_plan_tier`・利用枠（設定値）・サーバー側上限（いいね/メッセージ/翻訳）・`/app/plans` 比較・上限到達 UI | RLS/上限テスト、ja/ko スクショ |
| **P2** プレミアム機能 | 足あと・優先表示・相性診断・プロフィール添削/翻訳補助・イベント最小版＋割引/優先案内 | RLS テスト、ja/ko スクショ、E2E |
| **P3** Stripe（テストモード） | Checkout / Portal / Webhook、購入・更新・500⇄980変更・失敗・解約・返金の同期、`/app/plans/manage`、運営集計 | Stripe CLI/テストカードで 6 シナリオ、Webhook 重複、権限切替の確認 |

各 PR に「変更内容／スクリーンショット／日韓表示確認／テスト結果／未完了項目」を記載する。最終 PR で「事業者が決定する項目」一覧を `docs/monetization_salon/99_business_decisions.md` にまとめる。

## 6. 前提・必要な情報

- Stripe は **テストモードの Secret key（`sk_test_...`）と Webhook 署名シークレット**が必要（P3 着手時）。Supabase Edge Function Secrets に保存し、ブラウザには公開しない。本番キー（`sk_live_`）は設定しない。
- 韓国在住会員の請求通貨は JPY 固定で開始（設定 `plans.currency`）。KRW 表示は事業者判断待ち。
- 既存 E2E（`docs/step8_e2e_plan.md`）と RLS テストを壊さない。旧 Carat は変更しない。
