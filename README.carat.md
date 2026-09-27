# Carat Community - LGBTQ+ プレミアムコミュニティプラットフォーム

> ダイヤモンドの輝き × レインボープライド  
> 高級ジュエリーブランドのような洗練されたUIで、LGBTQ+コミュニティの交流・発信・支援を実現

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

---

## 概要

**Carat Community**は、LGBTQ+コミュニティのための次世代SNS/マーケットプレイスです。

### デザインコンセプト

「**ダイヤモンドの輝き × レインボープライド**」

- 白・シルバー・ゴールドを基調とした高級感あるデザイン
- 控えめで繊細なレインボーグラデーション
- Cartier のような贅沢な余白とエレガントなタイポグラフィ

---

## 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React | 18.3 | UI フレームワーク |
| TypeScript | 5.6 | 型安全 |
| Vite | 6.0 | ビルドツール |
| Tailwind CSS | 3.4 | スタイリング |
| shadcn/ui | - | UI コンポーネント（Radix UI ベース） |
| React Router | 7.9 | ルーティング |
| Framer Motion | - | アニメーション |

### バックエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| FastAPI | 0.116 | Web フレームワーク |
| SQLAlchemy | 2.0 | ORM |
| Alembic | 1.12 | マイグレーション |
| PostgreSQL | 17.4 | データベース |
| Psycopg2 | 2.9 | PostgreSQL ドライバ |
| WebSocket | - | リアルタイム通信 |
| Stripe | - | 決済処理 |

### インフラ

- **AWS App Runner**: API コンテナホスティング
- **AWS RDS (PostgreSQL)**: データベース
- **AWS S3**: 画像ストレージ
- **AWS ECR**: Docker イメージレジストリ
- **CloudWatch**: ログ・モニタリング

---

## 主な機能

### コアコミュニティ機能

- **投稿・フィード**: 画像・テキスト投稿、タグ付け、カテゴリー機能
- **カテゴリー体系**: サブカルチャー、Queer アート、ライフスタイル、観光・トラベル等

### 会員限定機能（有料会員: isPaidUser）

- **マッチング**: スワイプ式カード、趣味・興味ベースのマッチング、リアルタイムチャット
- **会員サロン**: 有料会員専用コミュニティ
- **フリマ（C2C）**: 会員同士で商品の売買
- **作品販売**: アート作品の販売
- **ジュエリーEC**: オリジナルジュエリー販売、Stripe決済統合
- **クラウドファンディング**: プロジェクト作成・支援

### 特別機能

- **バーチャル・ウェディング**: オンライン結婚式申し込み・管理

---

## 会員権限ルール

| 会員種別 | 変数名 | 権限 |
|----------|--------|------|
| 無料会員 | `isFreeUser` | 閲覧のみ、投稿・連絡・購入は不可 |
| 有料会員 | `isPaidUser` | 全機能利用可能 |

### 用語統一（2026-01-24完了）

| 旧用語 | 新用語 |
|--------|--------|
| `isAnonymous` | `isFreeUser` |
| `isPremium` | `isPaidUser` |
| `PremiumGate` | `PaidMemberGate` |
| `usePremium` | `usePaidMember` |

※ 後方互換のため旧用語はエイリアスとして残存

---

## セットアップ

### 前提条件

- Python 3.12+
- Node.js 18+
- PostgreSQL 17+
- Docker（デプロイ時）

### バックエンド起動

```bash
cd backend
./start_dev.sh
```

または手動:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL="postgresql+psycopg2://dbadmin:0034caretLgbtQ@rainbow-community-db-tokyo.cj8agmy8kjhv.ap-northeast-1.rds.amazonaws.com:5432/lgbtq_community?sslmode=require"
export PYTHONPATH=$(pwd):$PYTHONPATH

alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### フロントエンド起動

```bash
cd frontend
npm install
npm run dev
```

---

## 本番環境

- **フロントエンド**: Netlify (https://carat-rainbow-community.netlify.app)
- **バックエンド**: AWS App Runner
- **データベース**: AWS RDS PostgreSQL (ap-northeast-1)
  - ホスト: `rainbow-community-db-tokyo.cj8agmy8kjhv.ap-northeast-1.rds.amazonaws.com`
  - データベース名: `lgbtq_community`

---

## API エンドポイント

### 主要エンドポイント

- `GET /api/posts/` - 投稿一覧
- `POST /api/posts/` - 投稿作成
- `GET /api/matching/search` - マッチング検索
- `POST /api/matching/likes/{user_id}` - お気に入り追加
- `GET /api/jewelry/products` - ジュエリー商品一覧
- `POST /api/flea-market/items` - フリマ出品

**API ドキュメント**: http://localhost:8000/docs

---

## プロジェクト構成

```
carat_community/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── database.py
│   │   └── routers/
│   ├── alembic/
│   └── start_dev.sh
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── package.json
└── README.md
```

---

## 環境変数

### バックエンド

- `DATABASE_URL` - PostgreSQL接続文字列
- `PORT` - サーバーポート（デフォルト: 8000）
- `STRIPE_SECRET_KEY` - Stripe決済用
- `OPENAI_API_KEY` - OpenAI APIキー（翻訳機能用）
- `TRANSLATION_PROVIDER` - 翻訳プロバイダー（`openai` または `dummy`、デフォルト: `openai`）

### フロントエンド

- `VITE_API_BASE_URL` - バックエンドAPI URL
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe公開キー

---

## テストアカウント

- **Email**: tedyueda@gmail.com
- **Password**: tedyueda2024!

---

## ライセンス

現在検討中

---

## リアルタイム翻訳機能（2026-01-27 追加）

### 概要

投稿（post）の本文・タイトルを閲覧者の言語に自動翻訳して表示する機能です。

### 対応言語

- 日本語 (ja)
- 英語 (en)
- 韓国語 (ko)
- スペイン語 (es)
- ポルトガル語 (pt)
- フランス語 (fr)
- イタリア語 (it)
- ドイツ語 (de)

### 機能仕様

1. **オンデマンド翻訳**: 初回閲覧時に翻訳を生成し、データベースにキャッシュ
2. **原文/翻訳トグル**: ユーザーは原文と翻訳を切り替え可能
3. **言語検出優先順位**:
   - クエリパラメータ (`?lang=en`)
   - ブラウザ言語 (Accept-Language)
   - デフォルト: 日本語 (ja)

### API エンドポイント

- `GET /api/posts/{post_id}/translated?lang=en&mode=translated` - 翻訳付き投稿取得
- `GET /api/posts/languages` - 対応言語一覧

### 環境変数設定

```bash
# OpenAI APIキー（必須）
export OPENAI_API_KEY="sk-..."

# 翻訳プロバイダー（オプション、デフォルト: openai）
export TRANSLATION_PROVIDER="openai"
```

### データベースマイグレーション

```bash
cd backend
alembic upgrade head
```

これにより以下が作成されます:
- `posts` テーブルに `original_lang` カラム追加
- `post_translations` テーブル新規作成（翻訳キャッシュ用）

---

## 未解決の課題

### 創業メンバー紹介登録時のKYC認証エラー（2026-04-12）

**優先度**: 高  
**担当**: Devin

**問題の概要:**
- 創業メンバーコード（Ca01～Ca10）を使用して新規登録した際、メール認証後にKYC認証ページでエラーが発生
- 創業メンバー無料会員はKYC認証をスキップすべきだが、現在エラーが発生している

**詳細**: `FOUNDER_KYC_ISSUE.md` を参照

**関連ブランチ**: `devin/260412-founder-kyc-issue`

**関連コミット**:
- `e33e0f7` - fix: Skip KYC verification for founder free members
- `d8b7c8d` - Force backend redeployment to seed founder codes

---

## 解決済みの課題

### 講座・レッスン機能のデプロイ問題（2026-01-27 解決）

**問題の概要:**
- データベースには講座データが存在（1件確認済み）
- App Runnerにデプロイすると `/api/courses` エンドポイントが404エラー
- coursesルーターがApp Runnerで登録されていなかった

**根本原因:**
1. GitHub ActionsのAWS認証がOIDC方式で設定されていたが、IAMロールが存在しなかった
2. ECR Pushワークフローが `prod-v14` タグのみでプッシュしていたが、App Runnerは `latest` タグを参照していた

**解決策:**
1. **PR #2**: GitHub ActionsのAWS認証をOIDCからアクセスキー方式に変更
   - `.github/workflows/ecr-push.yml` と `.github/workflows/deploy.yml` を修正
   - GitHubリポジトリに `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` シークレットを追加

2. **PR #3**: ECR Pushワークフローで `latest` タグも同時にプッシュするよう修正
   ```yaml
   tags: |
     ${{ steps.ecr-url.outputs.ecr_url }}:${{ inputs.tag || 'prod-v14' }}
     ${{ steps.ecr-url.outputs.ecr_url }}:latest
   ```

3. App Runnerを手動で再デプロイ

**結果:**
- `/api/courses` エンドポイントが正常に動作
- フロントエンドで「スタジオQクリエイター総合塾 AIビジネス講座」が表示されることを確認
- https://carat-rainbow-community.netlify.app/business?tab=courses

**今後のデプロイ手順:**
1. コードをmainブランチにマージ
2. GitHub Actionsの「ECR Push」ワークフローを手動実行（または自動トリガー）
3. App Runnerコンソールで手動デプロイ（デプロイ方法が「手動」に設定されているため）

**関連PR:**
- https://github.com/tedueda/carat_community/pull/1 - App Runner再デプロイ強制
- https://github.com/tedueda/carat_community/pull/2 - AWS認証修正
- https://github.com/tedueda/carat_community/pull/3 - ECR latestタグ追加

---

**最終更新**: 2026-01-27  
**リポジトリ**: https://github.com/tedueda/carat_community
