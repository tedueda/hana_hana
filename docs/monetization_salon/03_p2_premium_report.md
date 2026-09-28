# P2 プレミアム機能 実装報告

対象: 足あと / 優先表示 / 相性診断 / プロフィール添削・翻訳補助 / イベント最小版（割引・先行受付）

## 1. 実装内容

| 機能 | サーバー側 | 画面 |
|---|---|---|
| 足あと | `record_profile_view(target)`（日次重複排除・非公開/停止/ブロックは記録しない）、`my_footprints_summary()`（全会員: 人数のみ）、`my_footprints(limit)`（プレミアムのみ、`premium_required`） | `/app/profile/footprints`（無料はロック表示） |
| 優先表示 | `recommend_users` のスコアに `priority_boost_score`（既定 15）を加算。reasons に `priority`。既存のブロック/非公開/見送り判定はそのまま | おすすめ理由チップ「優先表示」 |
| 相性診断 | `compatibility(target)`: 目的/言語交換の相互性/共通趣味/希望条件の 4 軸・0〜100 点。非プレミアムは `{unlocked:false}`。閲覧不可プロフィールは `profile_not_available` | `/app/users/:id` に診断カード（無料はロック） |
| 添削・翻訳補助 | Edge Function `translate` に `kind=profile_polish` / `profile_translate`。`plan_has_feature(uid,'profile_polish')` をサーバー側で検証（403 `premium_required`）。結果は提案として返し保存しない | `/app/profile/edit` 自己紹介下に「AIで添削」「韓国語/日本語に翻訳」→ 置き換え / 末尾に追加 / 使わない |
| イベント | `events` / `event_registrations`、`list_events(scope)`（本人の価格・割引率・受付開始時刻を返す）、`register_event` / `cancel_event_registration`（公開・中止・開始済・定員・先行受付・在籍状態をサーバー側で判定、申込時点の価格を保存）、`admin_upsert_event` / `admin_event_registrations` | `/app/events`（開催予定/参加予定/過去）、管理 `/app/admin/events` |
| 判定基盤 | `plan_has_feature(uid,key)` / `plan_feature_int(uid,key)` は `plans.features`（有効な subscription 起点）を参照 | `my_plan_features()` で画面側のロック表示のみ制御 |

- Migration: `supabase/migrations/20260927001600_premium.sql`（実環境 hana-hana へ適用済み）
- 新設定 (`app_settings`): `priority_boost_score=15`, `event_early_access_hours=48`, `footprints_days=30`
- `profile_views` / `event_registrations` は authenticated から直接書き込み不可（RPC 経由のみ）
- 会員画面から見えるイベントは公開済みのみ。他人の申込は見えない
- 本人確認バッジは従来通り `verifications` の審査結果のみで判定（課金と無関係、テスト Q02b）

## 2. テスト結果

- RLS/権限 SQL テスト `supabase/tests/rls_smoke_test.sql`: **190 passed, 0 failed**（P2 追加 Q01〜Q29: 無料/プレミアムの機能判定、足あとのロック・重複排除・ブロック/非公開除外・直接 insert 拒否、相性診断のロック/ブロック時拒否、優先表示の付与とブロック優先、イベントの管理者限定・先行受付・割引価格・定員・キャンセル・中止・非公開・停止会員拒否）
- フロント: `tsc -b` OK / ESLint (src/hanahana) 0 errors / `vite build` OK
- 実環境で `profile_polish` を実行し提案が返ることを確認（スクリーンショット ja_10）

## 3. スクリーンショット（375×812）

`docs/monetization_salon/screenshots/p2/`

| ja | ko | 内容 |
|---|---|---|
| ja_01_my_menu | ko_01_my_menu | マイページに「足あと」「イベント」 |
| ja_02_footprints_premium | ko_02_footprints_premium | 足あと（プレミアム） |
| ja_06_footprints_locked | ko_06_footprints_locked | 足あと（無料: 人数のみ+ロック） |
| ja_03_events_premium | ko_03_events_premium | イベント一覧（20%OFF・先行受付） |
| ja_07_events_free | ko_07_events_free | イベント一覧（無料: 定価・受付開始待ち） |
| ja_11_event_registered | – | 申込後（キャンセル・支払い案内） |
| ja_05_user_compat_premium | ko_05_user_compat_premium | 相性診断カード |
| ja_08_user_compat_locked | ko_08_user_compat_locked | 相性診断ロック |
| ja_04_profile_edit_ai / ja_10_profile_polish_result | ko_04_profile_edit_ai | AI添削・翻訳補助 |
| ja_09_profile_edit_locked | ko_09_profile_edit_locked | 無料会員のロック表示 |
| admin_10_events / admin_11_registrations / admin_12_event_form | – | 管理: イベント一覧・申込一覧・作成フォーム |

## 4. 未完了・次フェーズ

- イベント参加費のオンライン決済（P3 Stripe と合わせて検討。現状は「支払い方法は別途案内」表示）
- プレミアムの購入導線（P3: Stripe テストモード checkout / portal / webhook）
- 添削の非 OpenAI プロバイダー（DeepL/mock）は原文をそのまま返す
- `profile_translate` は `profile_polish` と同じ機能フラグで判定（プランの features で分ける場合は `plans.features` にキー追加）
- 事業者決定事項は `99_business_decisions.md` を参照
