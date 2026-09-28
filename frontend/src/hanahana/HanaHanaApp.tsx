import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { isSupabaseConfigured } from '@/lib/supabase';
import { SupabaseAuthProvider } from './auth/SupabaseAuthContext';
import { useSupabaseAuth } from './auth/useSupabaseAuth';
import { PREVIEW_LOGIN } from './auth/preview';
import { formatDate, I18nProvider, uiLangToLang, useI18n } from './i18n';
import { fetchConsentStatus, recordConsent } from './api/settings';
import AppShell from './components/AppShell';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages';
import ChatPage from './pages/ChatPage';
import ChatsPage from './pages/ChatsPage';
import { RecommendPage, SearchPage } from './pages/DiscoveryPages';
import LandingPage from './pages/LandingPage';
import { HelpPage, LegalNoticePage, PrivacyPage, SalonRulesPage, TermsPage } from './pages/LegalPages';
import AboutPage from './pages/AboutPage';
import PricingPage from './pages/PricingPage';
import { SalonNewPage, SalonPage, SalonPostPage } from './pages/SalonPages';
import { LikesPage, MatchesPage } from './pages/LikesMatchesPages';
import MyProfilePage from './pages/MyProfilePage';
import { VerificationPage } from './pages/MyPages';
import { PlansPage } from './pages/PlansPage';
import { BillingManagePage } from './pages/BillingManagePage';
import OnboardingPage from './pages/OnboardingPage';
import ProfileEditPage from './pages/ProfileEditPage';
import SettingsPage, { BlocksPage, ChangePasswordPage, DeleteAccountPage } from './pages/SettingsPage';
import UserProfilePage from './pages/UserProfilePage';
import AdminShell from './admin/AdminShell';
import DashboardPage from './admin/DashboardPage';
import UsersPage from './admin/UsersPage';
import UserDetailPage from './admin/UserDetailPage';
import ReportsPage from './admin/ReportsPage';
import SalonAdminPage from './admin/SalonAdminPage';
import EventsAdminPage from './admin/EventsAdminPage';
import FootprintsPage from './pages/FootprintsPage';
import EventsPage from './pages/EventsPage';
import VerificationsPage from './admin/VerificationsPage';
import MastersPage from './admin/MastersPage';
import AnnouncementsPage from './admin/AnnouncementsPage';
import { AdminsPage, AuditPage } from './admin/AuditAdminsPages';

const Loading: React.FC = () => {
  const { t } = useI18n();
  return <div className="min-h-screen flex items-center justify-center text-gray-500">{t('common.loading')}</div>;
};

/** ログイン後: プロフィールの preferred_ui_lang を表示言語に反映し、登録時の同意メタデータを user_consents へ記録する */
const SessionSync: React.FC = () => {
  const { user, profile } = useSupabaseAuth();
  const { setLang } = useI18n();
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !profile || synced.current === user.id) return;
    synced.current = user.id;
    if (profile.preferred_ui_lang) setLang(uiLangToLang(profile.preferred_ui_lang));

    const consent = user.user_metadata?.consent as { consented_at?: string } | undefined;
    if (!consent?.consented_at) return;
    fetchConsentStatus()
      .then((rows) => {
        const missing = rows.filter((r) => !r.is_current).map((r) => r.kind as 'terms' | 'privacy' | 'age');
        if (missing.length) return recordConsent(missing, profile.preferred_ui_lang ?? 'ja');
      })
      .catch(() => undefined);
  }, [user, profile, setLang]);

  return null;
};

const RequireAuth: React.FC = () => {
  const { session, profile, isLoading } = useSupabaseAuth();
  const { t, locale } = useI18n();
  const location = useLocation();
  if (isLoading) return <Loading />;
  if (!session) return <Navigate to="/app/login" replace state={{ from: location }} />;
  if (profile && !profile.onboarding_completed && location.pathname !== '/app/onboarding' && !location.pathname.startsWith('/app/admin')) {
    return <Navigate to="/app/onboarding" replace />;
  }
  return (
    <>
      <SessionSync />
      {PREVIEW_LOGIN && session.user.email === PREVIEW_LOGIN.email && (
        <div className="bg-sky-50 border-b border-sky-200 text-sky-900 text-xs px-4 py-1.5 text-center" role="status">
          {t('auth.previewMode', { name: profile?.nickname ?? '' })}
        </div>
      )}
      {profile?.status === 'suspended' && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm px-4 py-2 text-center" role="status">
          {t('auth.suspended', {
            until: profile.suspended_until ? t('auth.suspendedUntil', { date: formatDate(profile.suspended_until, locale) }) : '',
          })}
        </div>
      )}
      <Outlet />
    </>
  );
};

const GuestOnly: React.FC = () => {
  const { session, isLoading } = useSupabaseAuth();
  if (isLoading) return <Loading />;
  if (session) return <Navigate to="/app" replace />;
  return <Outlet />;
};

const NotConfigured: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center p-6 text-center text-gray-600 text-sm">
    Supabase is not configured. Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
  </div>
);

const HanaHanaApp: React.FC = () => {
  if (!isSupabaseConfigured) return <NotConfigured />;
  return (
    <I18nProvider>
      <SupabaseAuthProvider>
        <Routes>
          <Route path="welcome" element={<LandingPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="legal-notice" element={<LegalNoticePage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="salon-rules" element={<SalonRulesPage />} />
          <Route element={<GuestOnly />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequireAuth />}>
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route element={<AppShell />}>
              <Route index element={<RecommendPage />} />
              <Route path="search" element={<SearchPage />} />
            <Route path="salon" element={<SalonPage />} />
            <Route path="salon/new" element={<SalonNewPage />} />
            <Route path="salon/:postId" element={<SalonPostPage />} />
            <Route path="salon/:postId/edit" element={<SalonNewPage edit />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="chats" element={<ChatsPage />} />
              <Route path="chat/:conversationId" element={<ChatPage />} />
              <Route path="users/:userId" element={<UserProfilePage />} />
              <Route path="profile" element={<MyProfilePage />} />
              <Route path="profile/edit" element={<ProfileEditPage />} />
              <Route path="profile/likes" element={<LikesPage />} />
              <Route path="profile/footprints" element={<FootprintsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="likes" element={<Navigate to="/app/profile/likes" replace />} />
              <Route path="profile/verification" element={<VerificationPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="plans/manage" element={<BillingManagePage />} />
              <Route path="plus" element={<Navigate to="/app/plans" replace />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/blocks" element={<BlocksPage />} />
              <Route path="settings/password" element={<ChangePasswordPage />} />
              <Route path="settings/delete" element={<DeleteAccountPage />} />
            </Route>
            <Route path="admin" element={<AdminShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="users/:userId" element={<UserDetailPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="verifications" element={<VerificationsPage />} />
              <Route path="masters" element={<MastersPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="admins" element={<AdminsPage />} />
              <Route path="salon" element={<SalonAdminPage />} />
              <Route path="events" element={<EventsAdminPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </SupabaseAuthProvider>
    </I18nProvider>
  );
};

export default HanaHanaApp;
