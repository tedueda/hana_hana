# Hana-Hana（仮称）— 日韓マッチング・交流サービス

「日本と韓国をつなぐ、新しい出会い。」

日本人と韓国人が、恋愛・友達・日韓交流・言語交換・趣味・旅行時の交流など目的を選んでつながれるマッチング・交流サービスです。
旧 Carat Community（LGBTQ+ コミュニティ）を技術ベースとして再構築し、バックエンドは AWS/FastAPI から **Supabase** へ全面移行しました。

| 項目 | 値 |
|---|---|
| 本番 URL | https://hana-hana.netlify.app（ログイン: `/app/login`） |
| ホスティング | Netlify（tedueda's team / プロジェクト `hana-hana`）。`main` への push で自動デプロイ |
| バックエンド | Supabase `hana-hana`（StudioQ org, Tokyo `ap-northeast-1`, ref `pwugckmasgrinazktrme`） |
| サービス名 | 仮称。`VITE_APP_NAME` で差し替え可能（コードにはハードコードしない） |

> 旧 Carat（AWS / FastAPI / carat-community.com）は別リポジトリ `tedueda/carat_community` と別 Netlify サイトで稼働継続中。本リポジトリの変更は Carat に影響しません。旧 README は `README.carat.md`。

---

## 1. 機能一覧（MVP / Phase A）

### 会員向け（`/app`）

| 画面 | パス | 内容 |
|---|---|---|
| トップ | `/app/welcome` | サービス紹介 LP（日本人×韓国人 / 恋愛以外もOK / 言語交換 / 趣味 / 安全） |
| 会員登録・ログイン | `/app/register` `/app/login` `/app/forgot-password` `/app/reset-password` | Supabase Auth（メール + パスワード） |
| オンボーディング | `/app/onboarding` | 初回プロフィール作成（必須項目を入力しないと他画面へ進めない） |
| おすすめ | `/app` | ルールベースのおすすめユーザー（`recommend_users` RPC）。国籍・言語・目的・趣味・居住地・年齢のスコアリング |
| 探す | `/app/search` | 条件検索（国 / 年齢 / 性別 / 居住地 / 目的 / 母語・学習言語・レベル / 趣味 複数選択） |
| プロフィール閲覧 | `/app/users/:userId` | 写真・自己紹介・言語・趣味・目的・本人確認バッジ。いいね / ブロック / 通報 |
| いいね | `/app/likes` | 送った・もらったいいね |
| マッチ | `/app/matches` | 相互いいねで成立したマッチ一覧、マッチ解除 |
| チャット | `/app/chat/:conversationId` | マッチ成立後のみ 1対1。Supabase Realtime によるリアルタイム受信、既読 |
| マイプロフィール | `/app/profile` `/app/profile/edit` | 写真（最大 5 枚, Storage）、基本情報、言語、趣味、利用目的、公開/非公開 |

### 管理画面（`/app/admin`、`admin_users` 登録者のみ）

| 画面 | パス | 内容 |
|---|---|---|
| ダッシュボード | `/app/admin` | 会員数・マッチ数・未対応通報などの統計 |
| 会員管理 | `/app/admin/users` `/app/admin/users/:userId` | 検索、詳細、利用停止 / BAN / 復帰 |
| 通報管理 | `/app/admin/reports` | 通報一覧・対応（対応中 / 解決 / 却下 + 対象者の停止） |
| 本人確認 | `/app/admin/verifications` | 申請の承認 / 却下 |
| マスタ管理 | `/app/admin/masters` | 趣味 / 言語 / 利用目的 / 地域カテゴリーの追加・編集・表示順 |
| お知らせ | `/app/admin/announcements` | 会員向けお知らせの作成・公開 |
| 監査ログ | `/app/admin/audit` | 管理操作の履歴 |
| 管理者管理 | `/app/admin/admins` | 管理者の追加・権限（`super_admin` / `moderator` / `support`）・削除 |

### マッチングの流れ

```
会員登録 → プロフィール作成 → （本人確認）→ おすすめ / 探す → プロフィール閲覧
 → いいね → 相手もいいね → マッチ成立（DB トリガーで自動）→ 1対1チャット
```

- 相互いいねの検知・`matches` / `conversations` 作成・双方への通知は PostgreSQL トリガー（`handle_like`）で行い、クライアントの実装に依存しない。
- ブロックすると、検索・おすすめから除外、いいね・メッセージ停止、相互にプロフィール非表示（`handle_block` + RLS）。
- 通報理由: 不適切な内容 / なりすまし / 迷惑行為 / 詐欺の疑い / 不適切な写真 / その他。

---

## 2. 技術構成

```
Frontend (React SPA on Netlify)
   │  @supabase/supabase-js v2 (anon key)
   ▼
Supabase (hana-hana)
 ├─ PostgreSQL  … スキーマ / RLS / トリガー / RPC（ビジネスロジックは DB 側）
 ├─ Auth        … メール+パスワード、パスワードリセット
 ├─ Storage     … プロフィール写真 (profile-photos)
 └─ Realtime    … messages / notifications の購読
```

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + React Router v6。新サービスのコードは `frontend/src/hanahana/` に集約。
  - `api/` Supabase 呼び出し層（profile / discovery / matching / messages / master / admin）
  - `pages/` 会員画面、`admin/` 管理画面、`auth/` 認証コンテキスト、`labels.ts` 表示ラベル・エラーメッセージ（日本語）
- **Standalone モード**: `VITE_HANAHANA_STANDALONE=true` のビルドでは全パスを `/app` に割り当て、`index.html` の title / meta を Hana-Hana 用に差し替える（`frontend/vite.config.ts`）。Carat 画面は一切表示されない。
- **サーバー不要**: FastAPI などの独自 API サーバーは持たない。権限制御はすべて RLS と `security definer` RPC で担保。
- **サーバー鍵の扱い**: フロント・Netlify には anon key のみ。`service_role` キーは絶対に配置しない。

---

## 3. データベース（`supabase/migrations/`）

| ファイル | 内容 |
|---|---|
| `20260927000100_initial_schema.sql` | enum 型・全テーブル・インデックス |
| `20260927000200_functions_triggers.sql` | 相互いいね→マッチ、ブロック、既読、招待コード、検索/おすすめ RPC 等 |
| `20260927000300_rls.sql` | 全テーブルの RLS ポリシー |
| `20260927000400_seed_master.sql` | 言語 / 趣味 / 目的 / 地域 / プラン等のマスタ初期データ |
| `20260927000500_storage.sql` | Storage バケットとポリシー |
| `20260927000600_realtime.sql` | Realtime publication |
| `20260927000700_admin_rpc.sql` | 管理画面用 RPC（`admin_*`）と監査ログ |
| `20260927000800_restore_visibility.sql` | 利用停止解除時の公開状態復帰 |

### 主要テーブル

| 分類 | テーブル |
|---|---|
| 会員 | `profiles`（auth.users と 1:1、国籍 / 居住国・地域 / 性別 / 生年 / 職業 / 自己紹介 / 会員区分 / 状態 / 公開フラグ）, `profile_photos`, `user_languages`（母語 / 学習言語 + レベル）, `user_interests`, `user_purposes`, `invite_codes`（招待会員用。RPC のみで UI は未実装） |
| マスタ | `languages`, `interests`, `purposes`, `regions`, `plans`, `app_settings` |
| マッチング | `likes`, `matches`, `conversations`, `messages`, `message_translations`（将来の日韓翻訳用）, `user_events`（将来の AI レコメンド用行動ログ） |
| 安全 | `blocks`, `reports`, `verifications` |
| 通知・運用 | `notifications`, `announcements`, `admin_users`, `admin_audit_logs` |
| 課金（Phase B） | `subscriptions`, `payments`（料金は `plans` テーブルで管理、コードに固定しない） |

### 主な RPC / トリガー

- `handle_new_user`（登録時に profile 自動生成）、`handle_like`（相互いいね→match/conversation/通知）、`handle_block`、`after_message_insert`（通知）、`enforce_photo_limit`
- `recommend_users`, `search_profiles`, `candidate_profiles`（ブロック・停止・非公開を除外）
- `unmatch`, `mark_conversation_read`, `validate_invite_code` / `apply_invite_code`, `request_account_deletion`
- 管理: `admin_stats`, `admin_list_users`, `admin_get_user`, `admin_set_status`, `admin_list_reports`, `admin_resolve_report`, `admin_set_verification`, `admin_list_admins`, `admin_upsert_admin`, `admin_remove_admin`（全て `admin_audit_logs` に記録）

### セキュリティ（RLS）

- 全テーブルで RLS 有効。`profiles` は「公開 & 有効 & 相互ブロックなし」のみ他人から閲覧可。
- `messages` / `conversations` は参加者のみ、`likes` / `matches` / `blocks` / `reports` / `verifications` / `subscriptions` / `payments` は本人（または管理者 RPC）のみ。
- 他ユーザーの非公開データ・機密情報にアクセスできないことを `supabase/tests/rls_smoke_test.sql`（51 項目）で検証済み。

---

## 4. 環境・設定

### Netlify（プロジェクト `hana-hana`）

- リポジトリ `tedueda/hana_hana` / branch `main` / base `frontend` / build `npm run build` / publish `dist`
- 環境変数

```
VITE_SUPABASE_URL=https://pwugckmasgrinazktrme.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_APP_NAME=Hana-Hana
VITE_HANAHANA_STANDALONE=true
NODE_VERSION=20
# テスト段階のみ: 未ログイン時にデモ会員として自動ログイン（本番公開時は2つとも削除する）
VITE_PREVIEW_LOGIN_EMAIL=demo-saki@hanahana.test
VITE_PREVIEW_LOGIN_PASSWORD=<デモ会員のパスワード>
```

### Supabase Auth

- `site_url`: `https://hana-hana.netlify.app`
- Redirect URLs: `https://hana-hana.netlify.app/**`, `https://*--hana-hana.netlify.app/**`, `http://localhost:5173/**`
- メール送信: 現在は Supabase 内蔵メーラー（開発用、送信数制限あり）。正式公開前に SMTP（Resend / SES 等）設定が必要。

---

## 5. ローカル開発

```bash
cd frontend
cp .env.example .env.local   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定
npm install
npm run dev                  # http://localhost:5173/app
npm run build                # 本番ビルド
```

- DB 変更は `supabase/migrations/` に SQL を追加し、`supabase/scripts/apply_migrations.sh`（Management API）で適用。
- RLS / 権限テスト: `supabase/scripts/run_sql.sh supabase/tests/rls_smoke_test.sql`
- E2E テスト用アカウント（`supabase/tests/seed_e2e_users.sql`）: `e2e-admin@hanahana.test`（管理者）, `e2e-jp1@hanahana.test`, `e2e-kr1@hanahana.test`, `e2e-kr2@hanahana.test`。**正式公開前に削除する。**

---

## 6. ドキュメント

| ファイル | 内容 |
|---|---|
| `docs/step8_e2e_plan.md` / `docs/step8_e2e_report.md` | 総合テスト計画・報告（SQL 51/51 PASS, ブラウザ E2E 42 PASS, 修正した不具合 3 件） |
| `docs/step9_production_cutover.md` | 本番切替の構成・実施記録・残課題 |
| `supabase/README.md` | Supabase 構築・マイグレーション手順 |
| `README.carat.md` | 旧 Carat（AWS / FastAPI）の README |

現状分析・機能分類・システム構成・DB/RLS 設計・画面/API/管理画面仕様・AWS 停止チェックリスト等（STEP1〜4 の設計書）は `tedueda/carat_community` の PR #194（`docs/hanahana/`）を参照。

---

## 7. 今後の課題

- **Phase A 残**: 本人確認の申請 UI（現在は管理側の承認処理のみ）、パスワード変更・退会・ブロック解除の UI、実機（iPhone / Android）確認
- **運用開始前**: 独自ドメイン、本番 SMTP、実運用 `super_admin` の登録、E2E アカウント削除、favicon / OGP 画像 / sitemap の Hana-Hana 化、正式名称の決定
- **Phase B**: メール・プッシュ通知、有料会員（Stripe）、高度な検索、マッチング精度改善
- **Phase C**: AI レコメンド（`user_events` を利用）、日本語⇔韓国語メッセージ翻訳（`message_translations`）、イベント / コミュニティ
- **STEP10**: 新サービスの安定稼働確認後、旧 AWS 環境を段階的に停止（`carat_community` 側で実施）
