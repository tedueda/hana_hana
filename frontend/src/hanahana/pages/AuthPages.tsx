import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { APP_NAME } from '../labels';
import type { UiLang } from '../types';

const errorMessage = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(msg)) return 'メールアドレスまたはパスワードが正しくありません';
  if (/email not confirmed/i.test(msg)) return 'メールアドレスの確認が完了していません。届いたメールのリンクを開いてください';
  if (/already registered/i.test(msg)) return 'このメールアドレスは既に登録されています';
  if (/password/i.test(msg) && /8/.test(msg)) return 'パスワードは8文字以上にしてください';
  if (/rate limit/i.test(msg)) return '送信回数の上限に達しました。しばらくしてからお試しください';
  return msg;
};

const AuthCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 to-white px-4 py-10">
    <Card className="w-full max-w-md shadow-lg border-rose-100">
      <CardHeader className="text-center space-y-2">
        <p className="text-rose-600 font-bold tracking-wide">{APP_NAME}</p>
        <CardTitle className="text-2xl">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  </div>
);

export const LoginPage: React.FC = () => {
  const { signIn } = useSupabaseAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="ログイン" description="日本と韓国をつなぐ、新しい出会い。">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">メールアドレス</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">パスワード</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={busy}>
          {busy ? 'ログイン中…' : 'ログイン'}
        </Button>
        <div className="text-sm text-center text-gray-600 space-y-1">
          <p>
            <Link to="/app/forgot-password" className="underline">パスワードをお忘れですか？</Link>
          </p>
          <p>
            アカウントをお持ちでない方は <Link to="/app/register" className="text-rose-600 underline">新規登録</Link>
          </p>
        </div>
      </form>
    </AuthCard>
  );
};

export const RegisterPage: React.FC = () => {
  const { signUp } = useSupabaseAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [uiLang, setUiLang] = useState<UiLang>('ja');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { needsEmailConfirm } = await signUp(email, password, nickname, uiLang);
      if (needsEmailConfirm) setSent(true);
      else navigate('/app/onboarding', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="確認メールを送信しました">
        <p className="text-sm text-gray-700 text-center leading-relaxed">
          {email} に確認メールを送りました。メール内のリンクを開いて登録を完了してください。
        </p>
        <Button asChild variant="outline" className="w-full mt-6">
          <Link to="/app/login">ログイン画面へ</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="新規登録" description="無料で始められます">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nickname">ニックネーム</Label>
          <Input id="nickname" required maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">メールアドレス</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">パスワード（8文字以上）</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>表示言語</Label>
          <div className="flex gap-2">
            {(['ja', 'ko', 'en'] as UiLang[]).map((l) => (
              <Button key={l} type="button" size="sm" variant={uiLang === l ? 'default' : 'outline'} onClick={() => setUiLang(l)}>
                {l === 'ja' ? '日本語' : l === 'ko' ? '한국어' : 'English'}
              </Button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={busy}>
          {busy ? '登録中…' : '登録する'}
        </Button>
        <p className="text-sm text-center text-gray-600">
          すでにアカウントをお持ちの方は <Link to="/app/login" className="text-rose-600 underline">ログイン</Link>
        </p>
      </form>
    </AuthCard>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const { requestPasswordReset } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthCard title="パスワード再設定" description="登録メールアドレスに再設定リンクを送ります">
      {done ? (
        <p className="text-sm text-gray-700 text-center">メールを送信しました。リンクを開いて新しいパスワードを設定してください。</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input type="email" required placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">送信</Button>
        </form>
      )}
      <p className="text-sm text-center mt-4">
        <Link to="/app/login" className="underline text-gray-600">ログインへ戻る</Link>
      </p>
    </AuthCard>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword, session } = useSupabaseAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await updatePassword(password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthCard title="新しいパスワード">
      {!session ? (
        <p className="text-sm text-gray-700 text-center">リンクが無効か期限切れです。再度パスワード再設定を行ってください。</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input type="password" required minLength={8} placeholder="新しいパスワード（8文字以上）" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">変更する</Button>
        </form>
      )}
    </AuthCard>
  );
};
