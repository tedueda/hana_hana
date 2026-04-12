/**
 * STEP③: Referral Tracker
 * Invisible component that runs on app mount to:
 * 1. Check URL for ?ref=XXXX parameter
 * 2. Save referral code to cookie (30 days)
 * 3. Redirect to /subscribe?ref=XXXX if not logged in
 * 4. Apply referral code to user account after login
 */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, resilientFetch } from '../contexts/AuthContext';
import { initReferralTracking, getRefCodeFromCookie, extractRefCodeFromURL } from '../utils/referral';

const ReferralTracker: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // On mount: capture ref code from URL → cookie, redirect to register if not logged in
  useEffect(() => {
    const refCode = extractRefCodeFromURL();
    initReferralTracking();

    // If ref code is in URL and user is not logged in, redirect to register page
    if (refCode && !user && location.pathname === '/') {
      navigate(`/subscribe?ref=${encodeURIComponent(refCode)}`, { replace: true });
    }
  }, [user, navigate, location.pathname]);

  // After login: apply saved ref code to account (one-time)
  useEffect(() => {
    if (!user || !token) return;

    const refCode = getRefCodeFromCookie();
    if (!refCode) return;

    // Check if already applied (skip if referred_by already set)
    const applyReferral = async () => {
      try {
        const res = await resilientFetch('/api/founder/apply-referral', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref_code: refCode }),
        });
        if (res.ok) {
          console.log('Referral code applied successfully');
        }
        // 400 = already applied, which is fine
      } catch (e) {
        console.warn('Failed to apply referral:', e);
      }
    };

    applyReferral();
  }, [user, token]);

  return null; // invisible component
};

export default ReferralTracker;
