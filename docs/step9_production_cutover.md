# STEP9 本番切替 手順・実施記録（Hana-Hana）

方針: 新サービスは **別 Netlify サイト** で公開し、旧 Carat（carat-rainbow-community / carat-community.com）と AWS は無変更・稼働継続。

## 構成

| 項目 | 値 |
|---|---|
| Netlify サイト | `hana-hana-app`（site_id `68ef9633-f28f-49f6-903c-6b5f4ad2d6ae`） |
| URL | https://hana-hana-app.netlify.app |
| ビルド | `frontend/` を base、`npm run build`、publish `dist` |
| Supabase | hana-hana（ref `pwugckmasgrinazktrme`, Tokyo） |
| 旧 Carat | carat-rainbow-community（無変更） |

同一リポジトリ・同一ビルドで、環境変数 `VITE_HANAHANA_STANDALONE=true` のときだけ

- 全パスを新サービス（`/app/*`）に割り当て、それ以外は `/app` へリダイレクト（`frontend/src/App.tsx`）
- `index.html` の Carat 用 SEO メタ / JSON-LD / title を Hana-Hana 用に差し替え（`frontend/vite.config.ts` の `hanahanaHtml` プラグイン）

Carat サイトはこの変数を持たないため挙動は従来どおり。

## Netlify 環境変数（hana-hana-app に設定済み）

```
VITE_SUPABASE_URL=https://pwugckmasgrinazktrme.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>   # 公開キー。service_role は絶対に設定しない
VITE_APP_NAME=Hana-Hana
VITE_HANAHANA_STANDALONE=true
NODE_VERSION=20
```

## Supabase Auth（設定済み）

- `site_url`: `https://hana-hana-app.netlify.app`
- Redirect URLs: `https://hana-hana-app.netlify.app/**`, `https://*--hana-hana-app.netlify.app/**`（既存の localhost / carat 系も保持）

## 実施状況

| # | 作業 | 状態 |
|---|---|---|
| 1 | Netlify サイト作成・環境変数設定 | 完了 |
| 2 | Supabase Auth site_url / redirect 更新 | 完了 |
| 3 | 初回デプロイ（ローカルビルドを API で手動デプロイ） | 完了。`/` → `/app` 遷移、title 差し替えを確認 |
| 4 | GitHub リポジトリ連携（push で自動デプロイ） | **要ユーザー操作**: Netlify の GitHub App が tedyueda アカウントに未インストールのため API からリンクできず。Netlify Dashboard → hana-hana-app → Site configuration → Build & deploy → Link repository で `tedueda/carat_community`（branch `main`, base `frontend`）を選択 |
| 5 | 独自ドメイン | 未決（ドメイン決定後 Netlify → Domain management で追加し、Supabase Auth の site_url / redirect にも追加） |
| 6 | 本番 SMTP | 未設定（内蔵メーラー: 1時間あたり数通の制限。正式公開前に Resend / SES 等を Supabase Auth → SMTP に設定） |
| 7 | super_admin 登録 | E2E 用 `e2e-admin@hanahana.test` のみ。実運用の管理者は `insert into admin_users (user_id, role) values ('<auth.users.id>', 'super_admin')` を Dashboard SQL で実行 |
| 8 | E2E テストデータの削除 | 正式公開前に `supabase/tests/seed_e2e_users.sql` で作成した 4 アカウント（`*@hanahana.test`）を Auth から削除 |

## 手動デプロイ手順（リポジトリ連携までの暫定）

```bash
cd frontend
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... VITE_APP_NAME=Hana-Hana VITE_HANAHANA_STANDALONE=true npm run build
cd dist && zip -r ../hh.zip . && cd ..
curl -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" -H "Content-Type: application/zip" \
  --data-binary @hh.zip https://api.netlify.com/api/v1/sites/68ef9633-f28f-49f6-903c-6b5f4ad2d6ae/deploys
```

## 残課題

- `frontend/public` の favicon / robots / sitemap / `_redirects`（`/api/*` → AWS）は Carat 共用のまま。Hana-Hana 用アイコン・sitemap は正式名称決定後に差し替え。
- 旧 AWS 停止は STEP10（`docs/hanahana/10_aws_shutdown_checklist.md`）。本 STEP では触らない。
