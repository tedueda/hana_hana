import React, { useEffect } from 'react';
import { API_URL } from '@/config';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginForm from './components/LoginForm';
import HomePage from './components/HomePage';
import PostFeed from './components/PostFeed';
import ProfilePage from './components/ProfilePage';
import CreatePost from './components/CreatePost';
import CategoryPage from './components/CategoryPage';
import CategoryPageNew from './components/CategoryPageNew';
import BlogListPage from './components/BlogListPage';
import BlogDetailPage from './components/BlogDetailPage';
import NewsPage from './components/NewsPage';
import PremiumGate from './components/matching/PremiumGate';
import PaidMemberRoute from './components/PaidMemberRoute';
import MatchingLayout from './components/matching/MatchingLayout';
import MatchingSearchPage from './components/matching/MatchingSearchPage';
import MatchingLikesPage from './components/matching/MatchingLikesPage';
import MatchingMatchesPage from './components/matching/MatchingMatchesPage';
import MatchingProfilePage from './components/matching/MatchingProfilePage';
import MatchingChatDetailPage from './components/matching/MatchingChatDetailPage';
import MatchingPendingChatPage from './components/matching/MatchingPendingChatPage';
import MatchingUserProfilePage from './components/matching/MatchingUserProfilePage';
import MatchingSendMessagePage from './components/matching/MatchingSendMessagePage';
import MatchingChatShell from './components/matching/MatchingChatShell';
import FoodPage from './pages/members/FoodPage';
import BeautyPage from './pages/members/BeautyPage';
import VirtualWeddingPage from './components/VirtualWeddingPage';
import LiveWeddingApplicationForm from './components/LiveWeddingApplicationForm';
import DonationPage from './components/DonationPage';
import MarketplacePage from './pages/members/MarketplacePage';
import FavoritesPage from './pages/members/FavoritesPage';
import AccountPage from './pages/members/AccountPage';
import { SalonPage, SalonRoomDetailPage } from './components/salon';
import BusinessPage from './pages/members/BusinessPage';
import JewelryProductList from './components/jewelry/JewelryProductList';
import JewelryProductDetail from './components/jewelry/JewelryProductDetail';
import JewelryCart from './components/jewelry/JewelryCart';
import JewelryCheckout from './components/jewelry/JewelryCheckout';
import JewelryOrderComplete from './components/jewelry/JewelryOrderComplete';
import JewelryAdmin from './components/jewelry/JewelryAdmin';
import SubscribePage from './pages/SubscribePage';
import SubscribeSuccessPage from './pages/SubscribeSuccessPage';
import KycVerificationPage from './pages/KycVerificationPage';
import PostDetailPage from './pages/PostDetailPage';
import AboutPage from './pages/AboutPage';
import UsagePage from './pages/UsagePage';
import TermsPage from './pages/TermsPage';
import TokushohoPage from './pages/TokushohoPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ContactPage from './pages/ContactPage';
import AdminPage from './pages/AdminPage';
import PublicBlogListPage from './pages/PublicBlogListPage';
import PublicBlogDetailPage from './pages/PublicBlogDetailPage';
import MobileBottomBar from './components/MobileBottomBar';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { AudioProvider } from './contexts/AudioContext';
import GlobalAudioPlayer from './components/GlobalAudioPlayer';
import EmailVerificationPendingPage from './pages/EmailVerificationPendingPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ReferralTracker from './components/ReferralTracker';
import LeaderDashboardPage from './pages/LeaderDashboardPage';

const FeedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  return user ? <Navigate to="/feed" /> : <>{children}</>;
};

const RequestsRedirect: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  return <Navigate to={`/matching/chats/requests/${requestId}`} replace />;
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppContent() {
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '/feed';
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <ScrollToTop />
      <GlobalAudioPlayer />
      <ReferralTracker />
      <main className={`bg-white ${isHome ? '' : 'pt-40 md:pt-32'}`}>
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <LoginForm />
            </PublicRoute>
          } />
          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          } />
          <Route path="/reset-password" element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          } />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/about/usage" element={<UsagePage />} />
          <Route path="/about/terms" element={<TermsPage />} />
          <Route path="/about/tokushoho" element={<TokushohoPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/contact" element={<ContactPage />} />
          {/* Subscription routes */}
          <Route path="/subscribe" element={<SubscribePage />} />
          <Route path="/subscribe/success" element={<SubscribeSuccessPage />} />
          <Route path="/email-verification-pending" element={<EmailVerificationPendingPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/kyc-verification" element={<KycVerificationPage />} />
          <Route path="/feed" element={
            <FeedRoute>
              <HomePage />
            </FeedRoute>
          } />
          <Route path="/posts" element={
            <FeedRoute>
              <PostFeed />
            </FeedRoute>
          } />
          <Route path="/posts/:id" element={
            <FeedRoute>
              <PostDetailPage />
            </FeedRoute>
          } />
          <Route path="/profile" element={
            <FeedRoute>
              <PaidMemberRoute>
                <ProfilePage />
              </PaidMemberRoute>
            </FeedRoute>
          } />
          <Route path="/create/:category?" element={
            <FeedRoute>
              <CreatePost />
            </FeedRoute>
          } />
          <Route path="/create/:categoryKey" element={
            <FeedRoute>
              <CreatePost />
            </FeedRoute>
          } />
          {/* 旧カテゴリールート（後方互換性） */}
          <Route path="/category/:categoryKey" element={
            <FeedRoute>
              <CategoryPage />
            </FeedRoute>
          } />
          <Route path="/category/:categoryKey/new" element={
            <FeedRoute>
              <CategoryPage />
            </FeedRoute>
          } />
          {/* 新カテゴリールート（slug ベース） - Phase 1 */}
          <Route path="/category/:categorySlug/:subcategorySlug?" element={
            <FeedRoute>
              <CategoryPageNew />
            </FeedRoute>
          } />
          {/* Matching routes - 有料会員専用 */}
          <Route path="/matching" element={<PaidMemberRoute><MatchingLayout /></PaidMemberRoute>}>
            <Route index element={<MatchingSearchPage />} />
            <Route path="likes" element={<MatchingLikesPage />} />
            <Route path="matches" element={<MatchingMatchesPage />} />
            <Route path="chats" element={<MatchingChatShell />}>
              <Route index element={<div className="flex items-center justify-center h-full text-gray-500">左のリストから選択してください</div>} />
              <Route path=":id" element={<MatchingChatDetailPage embedded />} />
              <Route path="requests/:requestId" element={<MatchingPendingChatPage embedded />} />
            </Route>
            {/* Legacy redirect for old /matching/requests/:requestId paths */}
            <Route path="requests/:requestId" element={<RequestsRedirect />} />
            <Route path="users/:userId" element={<MatchingUserProfilePage />} />
            <Route path="compose/:userId" element={<MatchingSendMessagePage />} />
            <Route path="profile" element={<MatchingProfilePage />} />
          </Route>
          <Route path="/members/food" element={
            <FeedRoute>
              <FoodPage />
            </FeedRoute>
          } />
          <Route path="/members/beauty" element={
            <FeedRoute>
              <BeautyPage />
            </FeedRoute>
          } />
          <Route path="/live-wedding" element={<VirtualWeddingPage />} />
          <Route path="/live-wedding/application" element={<LiveWeddingApplicationForm />} />
          <Route path="/funding" element={
            <FeedRoute>
              <PremiumGate>
                <DonationPage />
              </PremiumGate>
            </FeedRoute>
          } />
          <Route path="/marketplace" element={
            <FeedRoute>
              <PremiumGate>
                <MarketplacePage />
              </PremiumGate>
            </FeedRoute>
          } />
          <Route path="/members/marketplace" element={
            <FeedRoute>
              <PremiumGate>
                <MarketplacePage />
              </PremiumGate>
            </FeedRoute>
          } />
          <Route path="/members/favorites" element={
            <FeedRoute>
              <FavoritesPage />
            </FeedRoute>
          } />
                    <Route path="/account" element={
                      <FeedRoute>
                        <AccountPage />
                      </FeedRoute>
                    } />
                    {/* Salon routes - 有料会員専用 */}
                    <Route path="/salon" element={<PaidMemberRoute><SalonPage /></PaidMemberRoute>} />
                    <Route path="/salon/rooms/:roomId" element={<PaidMemberRoute><SalonRoomDetailPage /></PaidMemberRoute>} />
                    {/* Business page - 閲覧は誰でもOK（出品・チャットは有料会員のみ） */}
                    <Route path="/business" element={<BusinessPage />} />
                    {/* Jewelry Shopping routes */}
                    <Route path="/jewelry" element={<JewelryProductList />} />
                    <Route path="/jewelry/:id" element={<JewelryProductDetail />} />
                    <Route path="/jewelry/cart" element={
                      <FeedRoute>
                        <JewelryCart />
                      </FeedRoute>
                    } />
                    <Route path="/jewelry/checkout" element={
                      <FeedRoute>
                        <JewelryCheckout />
                      </FeedRoute>
                    } />
                    <Route path="/jewelry/complete/:orderId" element={
                      <FeedRoute>
                        <JewelryOrderComplete />
                      </FeedRoute>
                    } />
                    {/* Jewelry Admin - 管理者のみ */}
                    <Route path="/jewelry/admin" element={
                      <FeedRoute>
                        <JewelryAdmin />
                      </FeedRoute>
                    } />
                    <Route path="/news" element={
            <FeedRoute>
              <NewsPage />
            </FeedRoute>
          } />
          <Route path="/admin" element={<AdminPage />} />
          {/* STEP③: Leader dashboard - role=leader only */}
          <Route path="/leader-dashboard" element={
            <FeedRoute>
              <LeaderDashboardPage />
            </FeedRoute>
          } />
          <Route path="/blog" element={<PublicBlogListPage />} />
          <Route path="/blog/:slug" element={<PublicBlogDetailPage />} />
          <Route path="/blog-members" element={
            <FeedRoute>
              <BlogListPage />
            </FeedRoute>
          } />
          <Route path="/blog-members/:slug" element={
            <FeedRoute>
              <BlogDetailPage />
            </FeedRoute>
          } />
          {/* Board routes */}
          <Route path="/board/subculture" element={<Navigate to="/category/subculture" replace />} />
          <Route path="/board/art" element={<Navigate to="/category/art" replace />} />
          <Route path="/board/music" element={<Navigate to="/category/music" replace />} />
          <Route path="/board/general" element={<Navigate to="/category/board" replace />} />
          <Route path="/board/shops" element={<Navigate to="/category/shops" replace />} />
          <Route path="/board/tourism" element={<Navigate to="/category/tourism" replace />} />
          {/* Funding redirect to category */}
          <Route path="/funding" element={<Navigate to="/category/funding" replace />} />
          <Route path="/" element={<Navigate to="/feed" />} />
        </Routes>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
}

function App() {
  React.useEffect(() => {
    console.info('🚀 Build:', import.meta.env.VITE_BUILD_ID || 'dev', '| API:', API_URL || '(same-origin)');
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <AudioProvider>
          <Router basename={import.meta.env.BASE_URL}>
            <AppContent />
          </Router>
        </AudioProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
