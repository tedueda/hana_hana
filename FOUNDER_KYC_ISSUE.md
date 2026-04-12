# 創業メンバー紹介登録時のKYC認証エラー

**作成日**: 2026-04-12  
**優先度**: 高  
**担当**: Devin

## 問題の概要

創業メンバーコード（Ca01～Ca10）を使用して新規登録した際、メール認証後にKYC認証ページでエラーが発生する。

## 再現手順

1. 管理画面（https://carat-community.com/admin）にログイン
2. 「創業メンバー管理」タブから創業メンバーコード（例: Ca01）のQRコードを取得
3. QRコードまたは紹介URLから新規会員登録
4. メールアドレス認証を完了
5. **送信されたメール内のリンクをクリック**
6. `/kyc-verification` ページに遷移
7. **エラーが発生**: "Inactive user" または 500 Internal Server Error

## 期待される動作

創業メンバー紹介で登録したユーザー（`is_founder_free_member=True` または `subscription_exempt=True`）は：
- KYC認証をスキップ
- メール認証後、直接ホームページ（`/`）に遷移
- 無料で全機能を利用可能

## 実施した対応

### 2026-04-12 の修正内容

#### バックエンド修正
**ファイル**: `backend/app/routers/stripe_billing.py`

```python
@router.post("/create-identity-session")
async def create_identity_session(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe Identity verification session for KYC."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Founder free members are exempt from KYC
    if current_user.subscription_exempt or current_user.is_founder_free_member:
        raise HTTPException(status_code=400, detail="KYC not required for founder free members")
    
    # Check if already verified
    if current_user.kyc_status == "VERIFIED":
        raise HTTPException(status_code=400, detail="Identity already verified")
```

#### フロントエンド修正
**ファイル**: `frontend/src/pages/KycVerificationPage.tsx`

```typescript
// Founder free members don't need KYC - redirect to home
if (res.status === 400 && data.detail === 'KYC not required for founder free members') {
  navigate('/');
  return;
}
```

### 問題点

上記の修正を実施したが、エラーは解消されず。

## 調査が必要な項目

### 1. ユーザー登録フロー
- 創業メンバーコードでの登録時、`is_founder_free_member` フラグが正しく設定されているか？
- `subscription_exempt` フラグが正しく設定されているか？
- メール認証後のリダイレクト先は適切か？

**確認ファイル**:
- `backend/app/routers/auth.py` - 登録エンドポイント
- `backend/app/routers/founder.py` - 創業メンバー登録ロジック

### 2. メール認証リンク
- メール認証リンクのリダイレクト先が `/kyc-verification` にハードコードされている可能性
- 創業メンバー無料会員の場合は `/` にリダイレクトすべき

**確認ファイル**:
- メール送信処理のコード
- メール認証後のリダイレクトロジック

### 3. データベース状態
- 創業メンバーコードで登録したユーザーのデータベースレコードを確認
- 以下のカラムの値を確認:
  - `is_founder_free_member`
  - `subscription_exempt`
  - `membership_type`
  - `referred_by_founder_code`
  - `kyc_status`

### 4. エラーログ
- App Runnerのログで詳細なエラーメッセージを確認
- どのエンドポイントで500エラーが発生しているか特定

## 関連ファイル

### バックエンド
- `backend/app/routers/stripe_billing.py` - KYC認証API
- `backend/app/routers/auth.py` - ユーザー登録・認証
- `backend/app/routers/founder.py` - 創業メンバー管理
- `backend/app/models.py` - Userモデル定義
- `backend/app/main.py` - 起動時の創業メンバーコード生成

### フロントエンド
- `frontend/src/pages/KycVerificationPage.tsx` - KYC認証ページ
- `frontend/src/pages/RegisterPage.tsx` - 登録ページ
- `frontend/src/pages/AdminPage.tsx` - 管理画面（創業メンバー管理タブ）

### データベース
- `founders` テーブル - 創業メンバーコード（Ca01～Ca10）
- `users` テーブル - ユーザー情報
- `referrals` テーブル - 紹介登録記録

## デバッグ手順

1. **ログ確認**
   ```bash
   aws logs tail /aws/apprunner/rainbow-community-api/service --follow --region ap-northeast-1
   ```

2. **データベース確認**
   ```sql
   -- 最新の創業メンバー紹介登録ユーザーを確認
   SELECT id, email, display_name, is_founder_free_member, subscription_exempt, 
          membership_type, referred_by_founder_code, kyc_status, created_at
   FROM users
   WHERE referred_by_founder_code IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. **API直接テスト**
   ```bash
   # ログインしてトークンを取得
   TOKEN="your_token_here"
   
   # KYC認証セッション作成をテスト
   curl -X POST "https://ddxdewgmen.ap-northeast-1.awsapprunner.com/api/stripe/create-identity-session" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json"
   ```

## 環境情報

- **フロントエンド**: https://carat-community.com (Netlify)
- **バックエンド**: https://ddxdewgmen.ap-northeast-1.awsapprunner.com (AWS App Runner)
- **データベース**: PostgreSQL on AWS RDS (ap-northeast-1)
- **最新デプロイ**: 2026-04-12 19:42 JST

## 関連コミット

- `e33e0f7` - fix: Skip KYC verification for founder free members
- `d8b7c8d` - Force backend redeployment to seed founder codes

## 次のアクション（Devin向け）

1. エラーログを確認し、具体的なエラー原因を特定
2. 創業メンバーコードでの登録フローを検証
3. メール認証後のリダイレクトロジックを修正
4. 修正後、テストユーザーで動作確認
5. 修正内容をPRで提出

---

**引き継ぎブランチ**: `devin/260412-founder-kyc-issue`
