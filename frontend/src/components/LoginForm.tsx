import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';

const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, error: authError, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    clearError();

    console.log('🔐 LoginForm: Submitting login');
    console.log('🔐 Environment check:', {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      MODE: import.meta.env.MODE,
      DEV: import.meta.env.DEV,
      PROD: import.meta.env.PROD,
    });

    const success = await login(email, password, rememberMe);
    
    if (success) {
      navigate('/feed');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <Card className="w-full max-w-md shadow-xl border-gray-200">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center">
            <img src="/images/logo02.png" alt="Carat Logo" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-3xl font-bold text-black">{t('auth.login.title')}</CardTitle>
          <CardDescription className="text-gray-500">
            {t('auth.login.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-black font-medium">{t('auth.login.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-gray-300 focus:border-black focus:ring-black h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-black font-medium">{t('auth.login.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-gray-300 focus:border-black focus:ring-black h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {(error || authError) && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{authError || t('auth.login.error')}</div>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-black focus:ring-black"
              />
              <Label htmlFor="rememberMe" className="text-sm text-gray-700 cursor-pointer">
                {t('auth.login.rememberMe')}
              </Label>
            </div>

            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-gray-700 hover:underline text-left"
            >
              パスワードを忘れた方
            </button>
            <Button 
              type="submit" 
              className="w-full bg-black hover:bg-gray-800 text-white h-12 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
          </form>
          <div className="mt-6 text-center border-t border-gray-200 pt-6 space-y-3">
            <p className="text-gray-600 text-sm">
              {t('auth.login.noAccount')}{' '}
              <button
                type="button"
                onClick={() => navigate('/subscribe')}
                className="text-black font-semibold hover:underline"
              >
                {t('auth.login.registerLink')}
              </button>
            </p>
            <p className="text-xs text-gray-400">
              <Link to="/about/terms" className="hover:underline">利用規約</Link>
              {' ・ '}
              <Link to="/privacy" className="hover:underline">プライバシーポリシー</Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
