/**
 * STEP③: Referral system utilities
 * - Cookie-based referral code storage (30 days)
 * - URL parameter extraction (?ref=XXXX)
 */

const REFERRAL_COOKIE_NAME = 'carat_ref';
const REFERRAL_COOKIE_DAYS = 30;

/** Set a cookie with expiry in days */
function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/** Get a cookie value by name */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/** Extract ref code from current URL query string */
export function extractRefCodeFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref') || null;
}

/** Save referral code to cookie (30 days) */
export function saveRefCodeToCookie(refCode: string): void {
  setCookie(REFERRAL_COOKIE_NAME, refCode, REFERRAL_COOKIE_DAYS);
}

/** Get saved referral code from cookie */
export function getRefCodeFromCookie(): string | null {
  return getCookie(REFERRAL_COOKIE_NAME);
}

/**
 * Initialize referral tracking:
 * - Check URL for ?ref=XXXX
 * - If found, save to cookie (30 days)
 * - Returns the ref code if present
 */
export function initReferralTracking(): string | null {
  const refFromURL = extractRefCodeFromURL();
  if (refFromURL) {
    saveRefCodeToCookie(refFromURL);
    return refFromURL;
  }
  return getRefCodeFromCookie();
}
