# Hana-Hana UI/UX 全面改修 — 差分表・画面構成・実装順序

仕様書「Hana-Hana UI/UX全面改修仕様書 v1.0 (2026-09-27)」への着手時点の確認結果。

## 1. 基準コミットとの差分

| 項目 | 値 |
|---|---|
| 仕様書の基準コミット | `db51a07459f0aefed7ff2c11339dbac6ecaea665` |
| 着手時点の `main` | `db51a07459f0aefed7ff2c11339dbac6ecaea665` |
| 差分 | **なし**（画面／DB／API／テストとも仕様書 §2 の記載どおり） |

仕様書 §2「重要な差分」の指摘（本人確認済み検索・生年月日・相手の希望は実装済み）は現行コードで再確認済み。

## 2. 既存機能の再利用箇所と追加実装箇所

### 2.1 画面

| 領域 | 既存（再利用） | 追加・変更 | PR |
|---|---|---|---|
| ログイン前 | `LandingPage`, `LoginPage`, `RegisterPage`, `ForgotPassword`, `ResetPassword` | 表示言語スイッチ（ログイン前、localStorage→`preferred_ui_lang`）、規約・プライバシー・18歳同意チェック、文言の辞書化 | 1, 2 |
| オンボーディング | `ProfileEditPage`（一括フォーム）の入力部品・保存 API | 8 段階のステップ UI（`OnboardingPage`）、段階ごと保存、`onboarding_step` で復帰、進捗バー、写真1枚必須 | 2 |
| ナビ | `AppShell`（上部ブランド／下部5タブ） | タブを「おすすめ／探す／マッチ／チャット／マイ」へ。いいね履歴は `/app/profile/likes` へ移動 | 1 |
| おすすめ | `RecommendPage` + `recommend_users` RPC + `ProfileCard`, `useLikeAction` | 1人大カード（写真主役、国籍・居住・目的・言語・認証・推薦理由）、「詳細／見送り／いいね」、見送りはセッション内で取り消し可、候補不足の案内 | 3 |
| 探す | `SearchPage` + `search_profiles` RPC | 写真グリッド、上部カテゴリ（新着／日本語学習中／韓国語学習中）、フィルターをボトムシート化、件数・空状態 | 3 |
| 相手詳細 | `UserProfilePage`（写真・言語・趣味・目的・いいね・通報・ブロック） | 共通点の表示、ブロック→設定のブロック一覧から解除可能に | 3 |
| マッチ | `MatchesPage`, `unmatch` RPC | 新規／会話中の区別、成立時モーダル（メッセージを送る／後で） | 3 |
| チャット一覧 | `fetchMatches`, `fetchUnreadCounts`（API のみ） | **新設** `/app/chats`（相手・最終本文抜粋・日時・未読件数） | 1 |
| チャット | `ChatPage`（Realtime, 既読） | 受信メッセージの「AI翻訳」、原文／訳文切替、自動翻訳 ON/OFF、送信前翻訳候補（編集→確認→送信）、失敗時再試行、通報・ブロック導線、キーボード表示中の入力欄 | 4 |
| マイ | `MyProfilePage` | 階層化: 主写真・完成度・本人確認・編集・いいね履歴・設定（表示言語／翻訳／通知／ブロック一覧／パスワード／規約・ヘルプ／退会） | 1 |
| 本人確認 | `verifications` テーブル、管理画面 `VerificationsPage` + `admin_set_verification` | 会員側の申請 UI（申請→審査中→承認／差戻し→再申請） | 2 |
| 設定・退会 | `request_account_deletion` RPC, `blocks` delete RLS, `updatePassword` | 設定画面・退会確認フロー・ブロック解除 UI | 1 |
| 管理 | `/app/admin/*` 全画面 | 変更なし（本人確認申請が既存審査キューに流れる） | – |

### 2.2 DB / RLS / RPC（すべて新規 Migration で追加。既存ファイルは編集しない）

| Migration | 内容 | PR |
|---|---|---|
| `..._0900_consents_settings.sql` | `user_consents`（規約版・日時・IP無し）、`user_settings`（auto_translate, translate_target_lang, notify_*）、`profiles.onboarding_step`、`app_settings` に `terms_version` / `privacy_version` / `photo_required` / `photo_grace_until` / `prefer_cross_nationality` / `translation_*`、`record_consent()` RPC、RLS | 1 |
| `..._1000_verification_request.sql` | `request_verification(p_name, p_birthdate)` RPC（pending 化、attempt_count++、資料は Storage private バケット `verification-docs` へ）、Storage ポリシー | 2 |
| `..._1100_photo_required.sql` | `candidate_profiles()` に「主写真あり」条件（`app_settings.photo_required` と猶予日で切替）、`public_profile` に `photo_count` | 2 |
| `..._1200_translation.sql` | `message_translations` INSERT は service_role のみ（RLS 明示）、`translation_usage`（日次件数・文字数）、`can_translate(message_id)` 参加者確認関数、`translation_requests` レート制御 | 4 |
| `..._1300_skips.sql` | `user_events.event_type='skip'` を利用し、`recommend_users` で 24h 内の見送りを後方へ（設定で期間変更可） | 3 |

既存 `handle_like` / `handle_block` / `recommend_users` / `search_profiles` の責務は変更しない（recommend は見送り除外の条件追加のみ）。

### 2.3 サーバー側処理（Supabase Edge Function）

| 関数 | 役割 | PR |
|---|---|---|
| `translate-message` | JWT 検証→会話参加者確認→キャッシュ確認→プロバイダー呼出→`message_translations` へ保存。本文長・分/日上限・タイムアウト。 | 4 |
| `translate-draft` | 送信前翻訳（保存しない）。同じ上限を適用。 | 4 |

翻訳プロバイダーは環境変数 `TRANSLATE_PROVIDER`（`openai` / `deepl` / `mock`）で切替。ブラウザから API を直接呼ばない。

### 2.4 テスト

| 既存 | 追加 |
|---|---|
| RLS/権限 SQL 51 項目（`supabase/tests/rls_smoke_test.sql`） | consents / user_settings / verification 申請 / translation 権限（第三者は取得・生成不可）を追加 |
| ブラウザ E2E 42 項目（`docs/step8_e2e_plan.md`） | 段階登録・写真必須・5タブ・チャット一覧・翻訳・設定・退会を追加。ja/ko 両言語のスクショ |

## 3. スマートフォン向け画面構成（375×812 基準、safe area 対応）

```
[ログイン前]
 /app/welcome ── 言語 [日本語|한국어] ─ 価値説明 ─ [無料で始める] [ログイン]
 /app/register ─ ニックネーム/メール/PW ─ ☑規約・プライバシー ☑18歳以上 ─ [登録]
 /app/login ─── メール/PW ─ [ログイン] ─ 再設定/新規登録

[オンボーディング /app/onboarding]  進捗バー ●●●○○○○○  ← 戻る / 次へ →（進むと保存）
 0 言語・同意  1 基本情報  2 交流相手  3 目的  4 言語  5 興味  6 写真(必須1枚)  7 自己紹介

[会員 AppShell]
 上部: ブランド ｜ 🔔通知
 下部5タブ: ✨おすすめ  🔍探す  💞マッチ  💬チャット  👤マイ

 /app          1人カード（縦長写真 / 🇯🇵🇰🇷 名前 年齢 / 居住地 / 目的・言語チップ / 認証 / 推薦理由）
               [詳細] [見送り] [♥いいね]   ※見送り直後に「元に戻す」トースト
 /app/search   カテゴリ切替（新着｜日本語学習中｜韓国語学習中）｜[条件]→ボトムシート ｜ 件数 ｜ 2列グリッド
 /app/users/:id 写真スライド / 基本 / 共通点 / 言語 / 目的 / 趣味 / 希望条件 / [♥] / 通報・ブロック
 /app/matches  新規マッチ（横スクロール） / 会話中 / 終了した会話
 /app/chats    会話一覧（アバター・名前・最終本文・時刻・未読バッジ）
 /app/chat/:id ヘッダー(相手・⋮通報/ブロック) / 吹き出し（[AI翻訳]／原文↔訳文）/ 入力欄 [翻訳して送る] [送信]
 /app/profile  主写真・完成度 / 本人確認状態 / 編集 / いいね履歴 / 設定
 /app/profile/likes  もらった｜送った
 /app/profile/verification  申請フォーム／審査中／承認／差戻し→再申請
 /app/settings  表示言語 / 翻訳 / 通知 / ブロック一覧 / パスワード / 規約・プライバシー・ヘルプ / 退会
 /app/terms, /app/privacy, /app/help
```

## 4. 実装順序（独立した PR 単位）

| # | 段階 | 内容 | 完了条件 |
|---|---|---|---|
| PR1 | A-1 | i18n 基盤（ja/ko 辞書・`useT`・ログイン前切替）、5タブナビ、`/app/chats`、マイページ階層、設定（表示言語・翻訳・通知・ブロック解除・パスワード・退会）、規約／プライバシー／ヘルプ（`app_settings` の版で管理）、Migration 0900 | 両言語で主要導線に直書き日本語なし。ブロック解除・退会がスマホで完走 |
| PR2 | A-2 | 段階式オンボーディング（同意・18歳・途中保存・進捗）、写真1枚必須（設定で切替＋猶予）、既存会員の補完バナー、本人確認申請 UI、Migration 1000/1100 | 新規会員が 18歳確認→登録→写真→完了。申請が管理画面の審査キューに出る |
| PR3 | A-3 | おすすめ大カード＋見送り、探すグリッド＋フィルターシート、マッチ成立モーダル、Migration 1300 | 発見→いいね→マッチ→会話をスマホで完走 |
| PR4 | B | 翻訳 Edge Function、Migration 1200、受信 AI 翻訳／自動翻訳／原文切替／送信前翻訳 UI、権限・失敗・再試行テスト | 日韓往復で原文保持・キャッシュ動作・失敗しても会話可・第三者は取得不可 |
| – | 共通 | RLS 51 項目＋追加項目の再実行、E2E 42 項目＋追加項目、README 更新 | 差分報告 |

段階 C（オンライン・距離・足あと）、D（Stripe・Plus）は対象外。本番公開・決済有効化は行わない。

## 5. 設定で変更可能にする未決事項と事業者判断一覧

| 未決事項 | 実装上の扱い（変更可能な設定） | 判断者 |
|---|---|---|
| 正式サービス名・独自ドメイン | `VITE_APP_NAME`、Netlify ドメイン設定 | 事業者 |
| 規約・プライバシー本文と版 | `app_settings.terms_version` / `privacy_version`、本文は `frontend/src/hanahana/legal/*.md`（ja/ko）。版更新時は再同意を要求 | 事業者（法務） |
| 年齢確認・本人確認の方式と適用法域 | `verifications.provider` は手動審査 (`manual`) で開始。外部サービスは `app_settings.verification_provider` で切替可能な設計 | 事業者（法務） |
| 本人確認資料の保存期間・削除 | `app_settings.verification_doc_retention_days`（既定 90）。削除は管理 RPC | 事業者 |
| 写真必須と既存会員の猶予 | `app_settings.photo_required`（既定 true）、`photo_grace_until`（既定 着手日+30日） | 事業者 |
| 写真審査体制 | 初回は事後審査（通報ベース）。事前審査は後段 | 事業者 |
| 同国籍候補の既定表示 | `app_settings.recommend_weights.nationality`（既存）で日韓相互を優先。0 にすると同等 | 事業者 |
| 翻訳プロバイダー・外部送信方針 | Edge Function 環境変数 `TRANSLATE_PROVIDER` / API キー。個人情報を含む本文をプロバイダーへ送る旨を翻訳設定画面に明記 | 事業者 |
| 翻訳の月間費用枠・利用上限 | `app_settings.translation_limits`（1メッセージ最大文字数・1分あたり回数・1日あたり回数）、自動翻訳の開放は `translation_auto_enabled` | 事業者 |
| 退会時のデータ処理 | 現行 `request_account_deletion` は論理削除（status=deleted）。物理削除は `app_settings.account_purge_days` で予告のみ | 事業者 |
| オンライン・距離・足あと | 段階 C。設定キーのみ予約 | 事業者 |
| Plus の価格・範囲 | 段階 D。`plans` テーブルから表示 | 事業者 |
| 本番 SMTP / 送信ドメイン | Supabase Auth 設定。現状は内蔵メーラー | 事業者 |
| E2E テストアカウント整理 | `e2e-*@hanahana.test` は公開前に管理 RPC で削除（手順は step9 文書） | 事業者承認後に実施 |
