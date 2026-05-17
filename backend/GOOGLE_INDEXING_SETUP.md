# Google Indexing API セットアップガイド

このガイドでは、ブログ記事の自動インデックス登録を有効にするための手順を説明します。

## 前提条件

- Google Cloud Platform アカウント
- Google Search Console でドメイン所有権確認済み

## セットアップ手順

### 1. Google Cloud Console でプロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成（または既存のプロジェクトを選択）
   - プロジェクト名：`carat-community-indexing`（任意）

### 2. Indexing API を有効化

1. 左メニュー → **APIとサービス** → **ライブラリ**
2. 検索ボックスに「**Indexing API**」と入力
3. **Indexing API** をクリック
4. **有効にする** をクリック

### 3. サービスアカウントを作成

1. 左メニュー → **APIとサービス** → **認証情報**
2. **認証情報を作成** → **サービスアカウント**
3. サービスアカウント名：`blog-indexing`（任意）
4. サービスアカウントID：`blog-indexing`（自動生成）
5. **作成して続行** をクリック
6. ロールは設定不要（スキップ）
7. **完了** をクリック

### 4. サービスアカウントキー（JSON）をダウンロード

1. 作成したサービスアカウントをクリック
2. **キー** タブ → **鍵を追加** → **新しい鍵を作成**
3. キーのタイプ：**JSON** を選択
4. **作成** をクリック
5. JSONファイルが自動ダウンロードされます
   - ファイル名例：`carat-community-indexing-abc123.json`

### 5. Google Search Console に所有者として追加

1. [Google Search Console](https://search.google.com/search-console) にアクセス
2. `carat-community.com` プロパティを選択
3. 左メニュー → **設定** → **ユーザーと権限**
4. **ユーザーを追加** をクリック
5. メールアドレス：サービスアカウントのメールアドレスを入力
   - 例：`blog-indexing@carat-community-indexing.iam.gserviceaccount.com`
   - （Google Cloud Console の認証情報ページで確認可能）
6. 権限：**所有者** を選択
7. **追加** をクリック

### 6. サーバーにJSONファイルを配置

#### ローカル開発環境

```bash
# backend ディレクトリに配置
cp ~/Downloads/carat-community-indexing-abc123.json /Users/tedueda/carat_community/backend/google-service-account.json
```

#### 本番環境（AWS App Runner）

1. JSONファイルの内容をbase64エンコード：

```bash
base64 -i google-service-account.json | pbcopy
```

2. AWS Systems Manager Parameter Store に保存：

```bash
aws ssm put-parameter \
  --name "/carat-community/google-service-account" \
  --type "SecureString" \
  --value "$(cat google-service-account.json)"
```

3. App Runner の起動スクリプトで環境変数を設定：

```bash
# .env または環境変数
GOOGLE_SERVICE_ACCOUNT_FILE=/app/google-service-account.json
```

4. Dockerfileまたは起動スクリプトでJSONファイルを作成：

```dockerfile
# Dockerfile に追加
RUN echo "$GOOGLE_SERVICE_ACCOUNT_JSON" > /app/google-service-account.json
```

### 7. 環境変数の設定

`.env` ファイルに以下を追加：

```bash
# Google Indexing API
GOOGLE_SERVICE_ACCOUNT_FILE=/app/google-service-account.json
```

### 8. 依存関係のインストール

```bash
cd backend
poetry install
```

### 9. 動作確認

ブログ記事を公開して、ログを確認：

```bash
# ログに以下のメッセージが表示されればOK
INFO: Google Indexing API initialized successfully
INFO: Notified Google Indexing API about published blog: https://carat-community.com/blog/test-article
```

## トラブルシューティング

### エラー: "Google service account file not found"

- JSONファイルのパスが正しいか確認
- ファイルの権限を確認（読み取り可能か）

### エラー: "403 Forbidden"

- Google Search Console でサービスアカウントが所有者として追加されているか確認
- Indexing API が有効化されているか確認

### エラー: "Invalid JSON"

- JSONファイルが破損していないか確認
- ダウンロードし直す

## セキュリティ注意事項

- **JSONファイルは絶対にGitにコミットしない**
- `.gitignore` に `google-service-account.json` を追加済み
- 本番環境では環境変数またはSecrets Managerを使用

## 参考リンク

- [Google Indexing API ドキュメント](https://developers.google.com/search/apis/indexing-api/v3/quickstart)
- [サービスアカウント作成ガイド](https://cloud.google.com/iam/docs/service-accounts-create)
