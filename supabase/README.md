# Supabase (Hana-Hana 新基盤)

設計書: `docs/hanahana/04_supabase_db_design.md`, `05_rls_design.md`

## プロジェクト

| 項目 | 値 |
|---|---|
| Organization | StudioQ |
| Project | hana-hana |
| Project ref | `pwugckmasgrinazktrme` |
| Region | ap-northeast-1 (Tokyo) |
| API URL | `https://pwugckmasgrinazktrme.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/pwugckmasgrinazktrme |

anon key / service_role key は Dashboard → Project Settings → API から取得する。
service_role key はサーバーサイド専用でフロントエンド・リポジトリには置かない。

フロントエンド用環境変数 (予定):

```
VITE_SUPABASE_URL=https://pwugckmasgrinazktrme.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## ディレクトリ

```
supabase/
  migrations/   適用順の SQL (タイムスタンプ順)
  functions/    Edge Functions (translate: サーバー側チャット翻訳)
  scripts/      Management API でのマイグレーション適用・SQL 実行
  tests/        RLS / トリガーのスモークテスト
```

### migrations

| ファイル | 内容 |
|---|---|
| `20260927000100_initial_schema.sql` | enum / 全テーブル / インデックス |
| `20260927000200_functions_triggers.sql` | `handle_new_user` (auth→profiles), `handle_like` (相互いいね→match/conversation/通知), `handle_block`, メッセージ通知, `public_profile` view, `recommend_users` / `search_profiles` RPC, admin RPC |
| `20260927000300_rls.sql` | 全テーブル RLS 有効化・ポリシー・列レベル権限・anon 権限剥奪 |
| `20260927000400_seed_master.sql` | 言語 / 目的 / 趣味 / 日本47都道府県 + 韓国17広域自治体 / app_settings |
| `20260927000500_storage.sql` | `profile-photos` バケットと Storage ポリシー |
| `20260927001300_translation.sql` | `translation_usage` (利用上限記録)・`my_translation_usage()`・`messages.ai_assisted`・`translation_provider` 設定 |

## 適用

```bash
export SUPABASE_ACCESS_TOKEN=<Personal Access Token>
export SUPABASE_PROJECT_REF=pwugckmasgrinazktrme
supabase/scripts/apply_migrations.sh
```

適用済みバージョンは `public.schema_migrations` に記録され、再実行時はスキップされる。
新しい変更は既存ファイルを編集せず、新しいタイムスタンプのファイルを追加する。

## Edge Function: translate

翻訳 API はブラウザから直接呼ばず `supabase/functions/translate` (service_role) 経由のみ。参加者確認・`app_settings.translation_limits` の上限 (max_chars / per_minute / per_day)・`message_translations` キャッシュ・15 秒タイムアウトをサーバー側で適用する。

```bash
# デプロイ (Management API)  ※ supabase CLI があれば `supabase functions deploy translate --project-ref $SUPABASE_PROJECT_REF`
# Secrets (Dashboard → Edge Functions → Secrets):
#   TRANSLATION_PROVIDER = openai | deepl | mock   (未設定なら OPENAI_API_KEY → DEEPL_API_KEY → mock の順で自動選択)
#   OPENAI_API_KEY, OPENAI_MODEL (既定 gpt-4o-mini) / DEEPL_API_KEY, DEEPL_API_URL
cd supabase/functions/translate && deno test detect_test.ts && deno check index.ts
```

## テスト

```bash
supabase/scripts/run_sql.sh supabase/tests/rls_smoke_test.sql
```

テストユーザーを作成して RLS 越境アクセス・相互いいね・ブロック・admin RPC を検証し、最後に `rollback` するため DB にデータは残らない。

## デモ用ダミー会員 (開発・確認用)

```bash
SUPABASE_PROJECT_REF=... supabase/scripts/run_sql.sh supabase/tests/seed_demo_users.sql   # 会員 4 名 (JP2/KR2)
SUPABASE_PROJECT_REF=... python3 supabase/scripts/upload_demo_photos.py                     # 写真を profile-photos へ
```

`demo-jp1/jp2/kr1/kr2@hanahana.test`（パスワード `Hanahana-Test1`）。おすすめ・探すに表示される。本番運用開始前に削除する。

## 主要な設計ポイント

- `auth.users` INSERT 時に `profiles` / `verifications` を自動作成
- `likes` の INSERT/UPDATE トリガーで相互いいねを検知し、`matches` (canonical: `user_low_id < user_high_id`) と `conversations` を get-or-create、双方へ `match` 通知。再いいねでは重複しない
- `blocks` INSERT で match を非アクティブ化し、双方向の like を `withdrawn` に
- `profiles` の `birthdate` / `pref_*` / 停止情報は列レベルで `authenticated` から剥奪し、本人は `my_profile()`、他人は `public_profile` view (年齢のみ) 経由で参照
- `member_tier` / `status` はユーザーが更新不可 (admin RPC / サーバー側のみ)
- `anon` ロールには public スキーマの権限なし
