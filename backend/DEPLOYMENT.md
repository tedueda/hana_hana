# 本番環境デプロイ手順

## Google Indexing API 環境変数設定

### AWS App Runner での設定

1. **AWS App Runner コンソール**を開く
2. `rainbow-community-api` サービスを選択
3. **「構成」** タブ → **「環境変数を編集」**
4. 以下の環境変数を追加：

| 名前 | 値 |
|------|-----|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | （下記のbase64エンコード済み文字列） |

### base64エンコード済みJSON

ローカルで以下のコマンドを実行してbase64文字列を取得：

```bash
cd /Users/tedueda/carat_community/backend
cat google-service-account.json | base64
```

出力された文字列全体をコピーして、AWS App Runnerの環境変数 `GOOGLE_SERVICE_ACCOUNT_JSON` に設定してください。

### 設定後

1. **「デプロイ」** をクリックして変更を適用
2. サービスが再起動されます
3. ログで以下のメッセージを確認：
   ```
   Setting up Google service account credentials...
   Google service account credentials configured successfully
   Google Indexing API initialized successfully
   ```

## デプロイ手順

### 1. コードをプッシュ

```bash
cd /Users/tedueda/carat_community/backend
git add .
git commit -m "feat: Add Google Indexing API with environment variable support"
git push origin main
```

### 2. Docker イメージをビルド＆プッシュ

```bash
# ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin 192933325498.dkr.ecr.ap-northeast-1.amazonaws.com

# イメージをビルド
docker build -t rainbow-community-api .

# タグ付け
docker tag rainbow-community-api:latest \
  192933325498.dkr.ecr.ap-northeast-1.amazonaws.com/rainbow-community-api:latest

# プッシュ
docker push 192933325498.dkr.ecr.ap-northeast-1.amazonaws.com/rainbow-community-api:latest
```

### 3. App Runner で環境変数を設定

上記の「Google Indexing API 環境変数設定」を参照

### 4. App Runner サービスをデプロイ

AWS App Runner コンソールで **「デプロイ」** をクリック

## 動作確認

1. ブログ記事を公開
2. App Runner のログを確認：
   ```
   INFO: Notified Google Indexing API about published blog: https://carat-community.com/blog/...
   ```
3. Google Search Console で1-3日後にインデックス確認

## トラブルシューティング

### エラー: "Google service account file not found"

- 環境変数 `GOOGLE_SERVICE_ACCOUNT_JSON` が設定されているか確認
- base64エンコードが正しいか確認

### エラー: "403 Forbidden"

- Google Search Console でサービスアカウントが所有者として追加されているか確認
- Indexing API が有効化されているか確認
