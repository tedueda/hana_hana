import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_URL } from '../../config';
import { LANGUAGE_NAMES, LANGUAGE_FLAGS, SupportedLanguage } from '../../i18n';
import { 
  User, Mail, Lock, AlertCircle, CheckCircle, Trash2, 
  Crown, Gem, MessageCircle, TrendingUp, Globe, ExternalLink, Save, Phone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccountData {
  id: number;
  email: string;
  display_name: string;
  membership_type: string;
  phone_number: string | null;
  real_name: string | null;
  is_verified: boolean;
  two_factor_enabled: boolean;
  is_active: boolean;
  created_at: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  website?: string;
  twitter?: string;
  instagram?: string;
  interests?: string[];
  country?: string;
  residence_country?: string;
  preferred_lang?: string;
  // Stripe subscription fields
  subscription_status?: string;
  kyc_status?: string;
  is_legacy_paid?: boolean;
  stripe_customer_id?: string;
}

interface UserStats {
  posts_count: number;
  likes_received: number;
  comments_count: number;
  total_points: number;
  monthly_points?: number;
}

export default function AccountPage() {
  const { t } = useTranslation();
  const { currentLanguage, setLanguage, supportedLanguages } = useLanguage();
  const navigate = useNavigate();
  
  const [account, setAccount] = useState<AccountData | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 編集用state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editResidenceCountry, setEditResidenceCountry] = useState('');
  const [saving, setSaving] = useState(false);

  // パスワード変更
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // アカウント削除
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        console.error(t('account.messages.fetchError'));
        setError(t('account.messages.fetchError'));
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      setAccount(data);
      setEditDisplayName(data.display_name || '');
      setEditPhoneNumber(data.phone_number || '');
      setEditResidenceCountry(data.residence_country || '');
      
      const statsRes= await fetch(`${API_URL}/api/users/me/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (e: unknown) {
      setError(t('account.messages.fetchError'));
      console.error('Account fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/account/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          display_name: editDisplayName,
          phone_number: editPhoneNumber,
          residence_country: editResidenceCountry,
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || t('account.messages.updateError'));
      }

      const data = await res.json();
      setAccount(data.account);
      setSuccess(t('account.messages.updateSuccess', 'アカウント情報を更新しました'));
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword= async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (newPassword !== confirmPassword) {
      setError(t('account.security.passwordMismatch'));
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/account/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || t('account.messages.updateError'));
      }
      
      setSuccess(t('account.security.passwordChanged'));
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      }
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (deleteConfirmation !== 'DELETE') {
      setError(t('account.danger.deleteConfirmation'));
      return;
    }
    
    if (!confirm(t('account.danger.deleteWarning'))) {
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/account/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || t('account.messages.updateError'));
      }
      
      alert(t('account.danger.deleteSuccess'));
      localStorage.removeItem('token');
      window.location.href = '/';
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      }
    }
  };

  // 未ログイン時は有料会員限定モーダルを表示（loadingチェックより先に判定）
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Lock className="h-16 w-16 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('matching.profile.premiumOnly')}</h2>
        <p className="text-gray-600 mb-6 text-center">
          {t('matching.profile.premiumOnlyDesc')}
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
        >
          {t('matching.profile.becomePremium')}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('account.title')}</h1>
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-green-800">{success}</p>
          </div>
        )}
        
        {/* セクション1: 会員ステータスサマリー */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-md p-6 mb-6 border-2 border-purple-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Crown className="w-5 h-5 mr-2 text-purple-600" />
            {t('account.status.title')}
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 有料会員ステータス */}
            <div className="bg-white rounded-lg p-4 text-center">
              <Crown className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <p className="text-sm text-gray-600">{t('account.status.premiumMember')}</p>
              <p className="text-lg font-bold text-purple-600">
                {account?.membership_type === 'premium' ? t('account.status.premiumMember') : t('account.status.freeMember')}
              </p>
            </div>
            
            {/* カラットポイント */}
            <div className="bg-white rounded-lg p-4 text-center">
              <Gem className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-gray-600">{t('account.status.caratPoints')}</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.total_points || 0}</p>
            </div>
            
            {/* 総コメント数 */}
            <div className="bg-white rounded-lg p-4 text-center">
              <MessageCircle className="w-6 h-6 mx-auto mb-2 text-pink-600" />
              <p className="text-sm text-gray-600">{t('account.status.totalComments')}</p>
              <p className="text-2xl font-bold text-pink-600">{stats?.comments_count || 0}</p>
            </div>
            
            {/* 今月の獲得ポイント */}
            <div className="bg-white rounded-lg p-4 text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="text-sm text-gray-600">{t('account.status.monthlyPoints')}</p>
              <p className="text-2xl font-bold text-green-600">{stats?.monthly_points || 0}</p>
            </div>
          </div>
          
          {stats && (
            <p className="text-sm text-gray-600 mt-4 text-center bg-white rounded-lg p-2">
              {t('account.status.pointsBreakdown', {
                likes: stats.likes_received,
                posts: stats.posts_count,
                total: stats.total_points
              })}
            </p>
          )}
        </div>
        
        {/* セクション2: アカウント情報 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
            <Mail className="w-5 h-5 mr-2 text-gray-600" />
            {t('account.info.title')}
          </h2>
          <p className="text-sm text-gray-500 mb-6">{t('account.info.description')}</p>
          
          <div className="space-y-4">
            {/* メールアドレス（読み取り専用） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.info.email')}
                <span className="ml-2 text-xs text-gray-400">({t('account.info.emailNote')})</span>
              </label>
              <input
                type="email"
                value={account?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            {/* 表示名（編集可能） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.register.displayName', '表示名')}
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* 携帯番号（編集可能） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                {t('auth.register.phone', '携帯番号')}
              </label>
              <input
                type="tel"
                value={editPhoneNumber}
                onChange={(e) => setEditPhoneNumber(e.target.value)}
                placeholder="090-1234-5678"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            {/* 表示言語 */}
            <div>
              <label htmlFor="displayLanguage" className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="w-4 h-4 inline mr-2" />
                {t('account.info.displayLanguage')}
              </label>
              <select
                id="displayLanguage"
                value={currentLanguage}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {LANGUAGE_FLAGS[lang]} {LANGUAGE_NAMES[lang]}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 居住国（編集可能） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.info.country')}
              </label>
              <select
                value={editResidenceCountry}
                onChange={(e) => setEditResidenceCountry(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">-</option>
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
            
            {/* 会員種別（読み取り専用） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('account.info.membershipType')}
              </label>
              <input
                type="text"
                value={account?.membership_type === 'premium' ? t('account.status.premiumMember') : t('account.status.freeMember')}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            
            {/* 保存ボタン */}
            <div className="pt-4">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? t('common.saving', '保存中...') : t('common.save', '保存')}
              </button>
            </div>
          </div>
        </div>
        
        {/* セクション3: プロフィール */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
            <User className="w-5 h-5 mr-2 text-gray-600" />
            {t('account.profile.title')}
          </h2>
          <p className="text-sm text-gray-500 mb-6">{t('account.profile.description')}</p>
          
          <button
            type="button"
            onClick={() => navigate('/matching/profile')}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center text-lg font-medium"
          >
            <ExternalLink className="w-5 h-5 mr-3" />
            {t('account.profile.editMatchingProfile')}
          </button>
        </div>
        
        {/* セキュリティセクション */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Lock className="w-5 h-5 mr-2 text-gray-600" />
            {t('account.security.title')}
          </h2>
          
          {!showPasswordForm ? (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
            >
              <Lock className="w-4 h-4 mr-2" />
              {t('account.security.changePassword')}
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('account.security.currentPassword')}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('account.security.newPassword')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                  minLength={8}
                />
                <p className="mt-1 text-sm text-gray-500">{t('account.security.passwordMinLength')}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {t('common.update')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* 危険な操作セクション */}
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
          <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center">
            <Trash2 className="w-5 h-5 mr-2" />
            {t('account.danger.title')}
          </h2>
          
          {!showDeleteForm ? (
            <div>
              <p className="text-gray-600 mb-4">
                {t('account.danger.deleteWarning')}
              </p>
              <button
                onClick={() => setShowDeleteForm(true)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('account.danger.deleteAccount')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-semibold">{t('account.danger.title')}</p>
                <p className="text-red-700 text-sm mt-2">
                  {t('account.danger.deleteWarning')}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.login.password')}
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('account.danger.deleteConfirmation')}
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  {t('account.danger.deleteButton')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteForm(false);
                    setDeletePassword('');
                    setDeleteConfirmation('');
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
