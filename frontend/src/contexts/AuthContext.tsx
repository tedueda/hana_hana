import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_URL, DIRECT_API_URL } from '@/config';

export const resilientFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  for (const base of [API_URL, DIRECT_API_URL]) {
    try {
      const res = await fetch(`${base}${path}`, init);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html') && !path.endsWith('.html')) continue;
      if (res.status < 500) return res;
    } catch (e) {
      console.warn(`Fetch failed for ${base || '(proxy)'}${path}`, e);
    }
  }
  throw new Error('All API endpoints failed');
};

interface User {
  id: number;
  email: string;
  display_name: string;
  nickname?: string;
  membership_type: string;
  is_active: boolean;
  created_at: string;
  avatar_url?: string;
  kyc_status?: string;
  subscription_status?: string;
  is_legacy_paid?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** 閲覧者（未ログイン）かどうか */
  isFreeUser: boolean;
  /** @deprecated isFreeUser を使用してください */
  isAnonymous: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isFreeUser, setIsFreeUser] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🔄 Initializing auth...');
      setIsLoading(true);
      
      const storedToken = localStorage.getItem('token');

      if (storedToken) {
        console.log('🔑 Found stored token, validating...');
        setToken(storedToken);
        
        try {
          const response = await resilientFetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          });
          
          if (response.ok) {
            const userData = await response.json();
            console.log('✅ Token valid, user data loaded:', userData);
            setUser(userData);
            setIsFreeUser(false);
            localStorage.removeItem('anonymous');
          } else {
            console.log('❌ Token invalid, clearing...');
            localStorage.removeItem('token');
            localStorage.removeItem('rememberMe');
            setToken(null);
            setIsFreeUser(true);
            localStorage.setItem('anonymous', 'true');
          }
        } catch (error) {
          console.error('Error validating token:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('rememberMe');
          setToken(null);
          setIsFreeUser(true);
          localStorage.setItem('anonymous', 'true');
        }
      } else {
        console.log('🔓 No stored token, setting anonymous');
        setIsFreeUser(true);
      }
      
      console.log('✅ Auth initialization complete');
      setIsLoading(false);
    };

    initializeAuth();
  }, []); // API_URLは定数なので依存配列から削除

  const login = async (email: string, password: string, rememberMe: boolean = true): Promise<boolean> => {
    console.log('Login attempt with:', { email, rememberMe, API_URL });
    
    try {
      console.log('🔑 Attempting login with API_URL:', API_URL);
      console.log('🔑 Full login URL:', `${API_URL}/api/auth/token`);
      
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      console.log('🔑 Request body:', formData.toString());
      
      const response = await resilientFetch('/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });
      
      console.log('Login response status:', response.status);
      console.log('Login response headers:', response.headers);
      
      if (response.ok) {
        const data = await response.json();
        const newToken = data.access_token;
        
        const userResponse = await resilientFetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${newToken}`,
          },
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log('User data loaded:', userData);
          
          setUser(userData);
          setToken(newToken);
          setIsFreeUser(false);
          
          if (rememberMe) {
            localStorage.setItem('token', newToken);
            localStorage.setItem('rememberMe', 'true');
          }
          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.removeItem('anonymous');
          
          return true;
        } else {
          console.error('Failed to fetch user data');
          setError('ユーザー情報の取得に失敗しました');
          return false;
        }
      } else {
        let detail = '';
        try {
          const errData = await response.json();
          detail = errData.detail || '';
        } catch (_e) {
          detail = '';
        }
        if (detail === 'EMAIL_NOT_VERIFIED') {
          setError('メールアドレスの確認が完了していません。登録時に届いたメールのリンクをクリックしてください。');
        } else if (detail === 'KYC_NOT_VERIFIED') {
          setError('本人確認（KYC）が完了していません。登録手続きを最初からやり直してください。');
        } else if (detail === 'SUBSCRIPTION_NOT_ACTIVE') {
          setError('決済が完了していません。登録手続きを最初からやり直してください。');
        } else {
          setError('メールアドレスまたはパスワードが正しくありません');
        }
        return false;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        API_URL,
      });
      setError(`ログインエラー: ${error.message}`);
      return false;
    }
  };

  const logout = () => {
    console.log('🚪 Logging out...');
    
    localStorage.removeItem('token');
    localStorage.removeItem('rememberMe');
    localStorage.setItem('anonymous', 'true');
    
    setToken(null);
    setUser(null);
    setIsFreeUser(true);
  };

  const value: AuthContextType = {
    user,
    token,
    isFreeUser,
    isAnonymous: isFreeUser, // 後方互換エイリアス
    login,
    logout,
    isLoading,
    error,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
