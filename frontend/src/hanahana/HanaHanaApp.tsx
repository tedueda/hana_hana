import React from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { isSupabaseConfigured } from '@/lib/supabase';
import { SupabaseAuthProvider } from './auth/SupabaseAuthContext';
import { useSupabaseAuth } from './auth/useSupabaseAuth';
import AppShell from './components/AppShell';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages';
import ChatPage from './pages/ChatPage';
import { RecommendPage, SearchPage } from './pages/DiscoveryPages';
import LandingPage from './pages/LandingPage';
import { LikesPage, MatchesPage } from './pages/LikesMatchesPages';
import MyProfilePage from './pages/MyProfilePage';
import ProfileEditPage from './pages/ProfileEditPage';
import UserProfilePage from './pages/UserProfilePage';
import AdminShell from './admin/AdminShell';
import DashboardPage from './admin/DashboardPage';
import UsersPage from './admin/UsersPage';
import UserDetailPage from './admin/UserDetailPage';
import ReportsPage from './admin/ReportsPage';
import VerificationsPage from './admin/VerificationsPage';
import MastersPage from './admin/MastersPage';
import AnnouncementsPage from './admin/AnnouncementsPage';
import { AdminsPage, AuditPage } from './admin/AuditAdminsPages';

const Loading: React.FC = () => <div className="min-h-screen flex items-center justify-center text-gray-500">読み込み中…</div>;

const RequireAuth: React.FC = () => {
  const { session, profile, isLoading } = useSupabaseAuth();
  const location = useLocation();
  if (isLoading) return <Loading />;
  if (!session) return <Navigate to="/app/login" replace state={{ from: location }} />;
  if (profile && !profile.onboarding_completed && location.pathname !== '/app/onboarding' && !location.pathname.startsWith('/app/admin')) {
    return <Navigate to="/app/onboarding" replace />;
  }
  return (
    <>
      {profile?.status === 'suspended' && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm px-4 py-2 text-center">
          このアカウントは現在利用停止中です
          {profile.suspended_until ? `（${new Date(profile.suspended_until).toLocaleString('ja-JP')} まで）` : ''}
          。いいね・メッセージなどの操作はできません。
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
    Supabase が未設定です。VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定してください。
  </div>
);

const HanaHanaApp: React.FC = () => {
  if (!isSupabaseConfigured) return <NotConfigured />;
  return (
    <SupabaseAuthProvider>
      <Routes>
        <Route path="welcome" element={<LandingPage />} />
        <Route element={<GuestOnly />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route path="onboarding" element={<ProfileEditPage onboarding />} />
          <Route element={<AppShell />}>
            <Route index element={<RecommendPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="likes" element={<LikesPage />} />
            <Route path="matches" element={<MatchesPage />} />
            <Route path="chat/:conversationId" element={<ChatPage />} />
            <Route path="users/:userId" element={<UserProfilePage />} />
            <Route path="profile" element={<MyProfilePage />} />
            <Route path="profile/edit" element={<ProfileEditPage />} />
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
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </SupabaseAuthProvider>
  );
};

export default HanaHanaApp;
