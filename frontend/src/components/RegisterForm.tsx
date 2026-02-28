import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart } from 'lucide-react';
import { useAuth, resilientFetch } from '@/contexts/AuthContext';

const RegisterForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [residenceCountry, setResidenceCountry] = useState('JP');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上である必要があります');
      setIsLoading(false);
      return;
    }

    if (!phoneNumber.trim()) {
      setError('携帯番号は必須です');
      setIsLoading(false);
      return;
    }

    if (!agreeTerms || !agreeAge) {
      setError('利用規約への同意と年齢確認が必要です');
      setIsLoading(false);
      return;
    }

    try {
      const response = await resilientFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          phone_number: phoneNumber.trim(),
          residence_country: residenceCountry
        })
      });

      if (response.ok) {
        // 登録成功後、自動的にログイン
        const loginSuccess = await login(email, password);
        if (loginSuccess) {
          navigate('/feed');
        } else {
          // ログインに失敗した場合はログインページへ
          navigate('/login');
        }
      } else {
        setError('このメールアドレスは既に使用されている可能性があります');
      }
    } catch (err) {
      setError('登録に失敗しました');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-carat-gray1 px-4">
      <Card className="w-full max-w-md bg-carat-white border-carat-gray2 shadow-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Heart className="h-12 w-12 text-carat-gray4" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl md:text-4xl text-carat-black">会員登録</CardTitle>
          <CardDescription className="text-lg md:text-xl text-carat-gray5">
            アカウントを作成して全機能をご利用ください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-lg md:text-xl text-carat-black">表示名</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="border-carat-gray3 focus:border-carat-black focus:ring-carat-black/20"
                placeholder="太郎ちゃん"
              />
              <p className="text-sm text-carat-gray5">
                ニックネームを入力してください。本名は後で設定できます。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-lg md:text-xl text-carat-black">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-carat-gray3 focus:border-carat-black focus:ring-carat-black/20"
                placeholder="example@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-lg md:text-xl text-carat-black">
                携帯番号 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="border-carat-gray3 focus:border-carat-black focus:ring-carat-black/20"
                placeholder="090-1234-5678"
              />
              <p className="text-sm text-carat-gray5">
                固有のIDとして使用されます。変更できません。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="residenceCountry" className="text-lg md:text-xl text-carat-black">居住国</Label>
              <select
                id="residenceCountry"
                value={residenceCountry}
                onChange={(e) => setResidenceCountry(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-carat-gray3 focus:border-carat-black focus:ring-carat-black/20 bg-white"
              >
                <option value="JP">Japan</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="KR">South Korea</option>
                <option value="CN">China</option>
                <option value="TW">Taiwan</option>
                <option value="TH">Thailand</option>
                <option value="SG">Singapore</option>
                <option value="PH">Philippines</option>
                <option value="BR">Brazil</option>
                <option value="MX">Mexico</option>
                <option value="IN">India</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-lg md:text-xl text-carat-black">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-carat-gray3 focus:border-carat-black focus:ring-carat-black/20"
                placeholder="8文字以上"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-lg md:text-xl text-carat-black">パスワード（確認）</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-carat-gray3 focus:border-carat-black focus:ring-carat-black/20"
                placeholder="パスワードを再入力"
              />
            </div>
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-black focus:ring-black/20 shrink-0"
                />
                <span className="text-sm text-gray-700">
                  <Link to="/about/terms" target="_blank" className="text-purple-700 hover:text-purple-900 underline">利用規約</Link>
                  ・
                  <Link to="/privacy" target="_blank" className="text-purple-700 hover:text-purple-900 underline">プライバシーポリシー</Link>
                  に同意します
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeAge}
                  onChange={(e) => setAgreeAge(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-black focus:ring-black/20 shrink-0"
                />
                <span className="text-sm text-gray-700">
                  私は18歳以上です
                </span>
              </label>
            </div>
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>
            )}
            <Button 
              type="submit" 
              className="w-full bg-black text-white hover:bg-gray-800 transition-colors text-lg font-bold py-6 shadow-lg hover:shadow-xl"
              disabled={isLoading || !agreeTerms || !agreeAge}
            >
              {isLoading ? '登録中...' : '登録して本人確認へ'}
            </Button>
          </form>
          <div className="mt-6 text-center space-y-2">
            <p className="text-base text-black">
              すでに会員の方は{' '}
              <Link to="/login" className="text-purple-700 hover:text-purple-900 font-semibold underline">
                ログイン
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterForm;
