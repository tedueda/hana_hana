# hana_hana
日韓マッチングアプリ（仮称 Hana-Hana）

日本と韓国をつなぐマッチング・交流サービス。旧 Carat Community を技術ベースとして再構築し、バックエンド/DB は Supabase（`supabase/`）、新サービス画面は `frontend/src/hanahana`（`/app` 配下）に実装しています。

- 本番: https://hana-hana-app.netlify.app
- 設計ドキュメント: `docs/`（STEP8 テスト報告 `docs/step8_e2e_report.md`、STEP9 切替手順 `docs/step9_production_cutover.md`）
- Supabase スキーマ/RLS/テスト: `supabase/migrations`, `supabase/tests`
- ローカル起動: `frontend/.env.example` を参考に `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を設定し `cd frontend && npm install && npm run dev`

旧 Carat（AWS/FastAPI）の説明は `README.carat.md` を参照。
