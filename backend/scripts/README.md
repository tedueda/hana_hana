# Scripts

## notify_all_blogs.py

既存の全ブログ記事をGoogle Indexing APIに一括通知するスクリプト

### ローカル実行（テスト用）

```bash
cd backend
python3 scripts/notify_all_blogs.py
```

### 本番環境（AWS App Runner）で実行

1. AWS App Runnerコンソールを開く
2. `rainbow-community-api` サービスを選択
3. 「構成」→「サービスの詳細」→「コンソールに接続」
4. 以下のコマンドを実行：

```bash
cd /app
python3 scripts/notify_all_blogs.py
```

### 注意事項

- Google Indexing APIには1日あたりのクォータ制限があります（通常200リクエスト/日）
- 大量のURLを一度に送信すると制限に達する可能性があります
- エラーが発生した場合は、時間をおいて再実行してください

### 代替方法：curlで実行

AWS App Runnerにアクセスできない場合、管理APIエンドポイントを作成して実行することもできます。
