# 利用者向け公開ページ（Hana-Hanaについて / 料金プラン / 利用規約）— レビュー資料

対象ブランチ: `devin/1790628672-public-pages`（料金体系 v2 = PR #14 を前提）

## 1. 追加・変更したページと導線

| URL | 内容 | ログイン前 | ログイン後 |
|---|---|---|---|
| `/app/about` | Hana-Hanaについて（FV・コンセプト・できること・安心の仕組み・利用開始の流れ・登録CTA） | 共通ヘッダー/フッター | 設定 › 「Hana-Hanaについて」から。CTA は `/app` へ |
| `/app/pricing` | 料金プラン（ログイン前）。購入ボタンなし・登録CTAのみ | 共通ヘッダー/フッター | `/app/plans` へリダイレクト |
| `/app/plans` | 既存の料金プラン（ログイン後）。`PlanComparison` を共有し `/app/pricing` と同一内容 + Stripe Checkout/Portal | — | マイ › 料金プラン |
| `/app/terms` | 利用規約 レビュー用ドラフト（日韓 18条） | 共通ヘッダー/フッター（言語切替可） | 設定 › 利用規約（版表示） |
| `/app/privacy` | 既存プライバシーポリシー（関連リンク追加） | 同上 | 設定 › プライバシーポリシー |
| `/app/legal-notice` | 特定商取引法に基づく表示 ドラフト（事業者情報はプレースホルダー） | 同上 | 設定 › 特定商取引法に基づく表示 |

- ログイン前ヘッダー: ロゴ / Hana-Hanaについて / 料金プラン / 日本語・한국어 / ログイン
- ログイン前フッター: 利用規約 / プライバシーポリシー / 特定商取引法に基づく表示 / ヘルプ
- 料金ページ（前後とも）から 規約・プライバシー・特商法表示・About へリンク
- DB: `public_plans()` RPC（anon 可、`is_active` のプランのみ）と `public_settings()` に `past_due_grace_days` を追加（実環境適用済み）

## 2. 公開文言と実装の照合（差異一覧）

| 表示 | 実装上の根拠 | 差異 / 備考 |
|---|---|---|
| 女性会員は全機能無料 | `app_settings.free_full_access_genders = ["female"]`、`plan_exempt()` で数値上限も無制限 | 一致。設定変更で対象性別を変えられる |
| 無料: いいね3/日、メッセージ不可、翻訳2/日、写真1枚 | `plan_limits.free`、`plans.features.photo_view_max=1` | 一致 |
| ライト ¥1,000: いいね30/月、メッセージ10/月、翻訳5/日、写真3枚 | `plan_limits.light`、Stripe `hanahana_light_monthly` | 一致 |
| スタンダード ¥2,980: いいね100/月、メッセージ無制限、翻訳30/日、写真無制限、本人確認検索、足あと、優先表示、相性診断、添削、イベント | `plan_limits.standard`、`plans.features`、Stripe `hanahana_standard_v2_monthly` | 一致 |
| 迷惑行為防止の送信制限 1分{n}通 | `message_rate_per_minute = 20` | 一致（設定値を表示） |
| 課金開始 = 決済確定日、毎月同日更新 | Stripe subscription の `current_period_*` | 一致 |
| 解約後は期間満了まで利用可 | webhook `cancel_at_period_end` → `subscriptions.status` | 一致 |
| 決済失敗時 7日猶予後に無料へ | `past_due_grace_days = 7`、`current_plan_tier()` | 一致 |
| 返金条件 | **未確定**（「事業者が確定中」と表示。日割り返金なしを前提） | 要決定 |
| イベント料金は別途 | `events.price_jpy`、割引率 `event_discount_pct` | 一致。金額は開催毎 |
| 税込表示 | Stripe Price は tax 設定なしの ¥1,000 / ¥2,980 | 一致（内税扱い） |
| Stripe テストモード・実請求なし | `stripe_mode = "test"`、本番キー未設定 | 一致 |
| 本人確認済み表示は審査結果 | `verifications` 審査 → `profiles.is_verified`。課金と無関係 | 一致 |
| ポイント課金 | 未実装。「将来提供予定」表記のみ | 実装なし（次PR候補） |
| 退会時の有料プラン自動解約 | 退会 RPC は Stripe 購読を解約しない | 規約に「退会前に解約」と明記。自動解約は未実装 |

## 3. 利用規約・特商法表示の未確定事項（公開前に事業者・専門家の確認が必要）

| 項目 | 現在の表示 | 必要な対応 |
|---|---|---|
| 運営者の正式名称・運営責任者 | 要確認 | 事業者情報を確定し `legal/content.ts` に反映 |
| 所在地・電話番号・メールアドレス | 要確認 | 同上（特商法 11条の表示事項） |
| 準拠法・管轄裁判所 | 要確認（日本法・日本の裁判所を想定と記載） | 専門家確認 |
| 返金条件 | 確定中 | 決定後に規約 §12 と料金ページ注記を更新 |
| 本人確認書類の保存期間 | `verification_doc_retention_days = 90` を表示 | 法令上の要否と期間を確認 |
| 退会後のデータ削除期間 | `account_purge_days = 30` を表示 | 同上 |
| 年齢確認方法 | 登録時の18歳以上申告 + 任意の本人確認書類審査 | 下記 4. の警察庁の解釈基準（施行規則5条）に照らし、公開前に方法・タイミングを確定 |
| インターネット異性紹介事業の届出 | 未記載 | 公安委員会への届出要否・番号を確認し、確定後に特商法表示/規約へ記載 |
| 翻訳プロバイダへの送信 | OpenAI へ本文を送信（プロンプトに個人情報は含めない）と記載 | プライバシーポリシーの第三者提供/委託の記載と整合確認 |
| 規約の版 | `terms_version = 2026-09-27`、登録時に `record_consent` で記録 | 規約確定時に版を更新し、既存会員へ再同意フローが必要か判断 |

## 4. 法務確認の参考資料（公的機関）

- 警察庁「インターネット異性紹介事業を利用して児童を誘引する行為の規制等に関する法律」（届出様式・案内）  
  https://www.npa.go.jp/policies/application/form/19/index.html  
  解釈基準（児童でないことの確認方法 = 施行規則第5条: 年齢を証する書面の提示/写し/画像送信、マイナンバーカード等）  
  https://www.npa.go.jp/policy_area/no_cp/uploads/R8_deaikeikaishaku.pdf
- 消費者庁「通信販売の申込み段階における表示についてのガイドライン」（特商法12条の6: 最終確認画面の表示事項）  
  https://www.caa.go.jp/policies/policy/consumer_transaction/specified_commercial_transactions/assets/consumer_transaction_cms101_2401119_03.pdf  
  → 本実装では Stripe Checkout がプラン名・金額・請求周期を確認する最終画面。分量・支払時期・解約条件の表示は Stripe 側画面と特商法表示ページで補う
- 個人情報保護委員会「個人情報の保護に関する法律についてのガイドライン（通則編）」  
  https://www.ppc.go.jp/personalinfo/legal/ （PDF: https://www.ppc.go.jp/files/pdf/250601_guidelines01.pdf）

## 5. 検証

- `npx tsc --noEmit -p tsconfig.app.json` / ESLint（変更ファイル） / `npm run build` 通過
- anon で `public_plans()` `public_settings()` 取得可、`plans` テーブル直接参照は authenticated のみのまま
- ブラウザ録画テスト（375×812 / 1280×800、日韓、ログイン前後）: 導線・料金一致・購入ボタン非表示・リダイレクト・規約版・回帰（おすすめ/チャット/サロン）PASS。初回検出の日本語はみ出し（`break-keep`）は修正済み
