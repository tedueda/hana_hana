# Carat Community Frontend Testing

## Dev Server Setup

```bash
cd frontend
npm install
npm run dev -- --port 5175
```

The Vite dev server proxies `/api/*` requests to the production backend at `https://ddxdewgmen.ap-northeast-1.awsapprunner.com`. This means you can test real API responses without running the backend locally.

## Key Test Patterns

### Matching Feature (Anonymous User)
- Navigate to `/about?tab=matching`
- Anonymous users should fetch from `/api/matching/public-preview` (NOT `/api/matching/search`)
- Endpoint selection is controlled by `isPaidUser` from `usePaidMember()` hook
- Cards should render with blurred avatars (`blur-sm` CSS class)
- Clicking a card should show a login modal with "会員限定" text, not navigate to profile

### Matching Feature (Paid User)
- Paid users fetch from `/api/matching/search` which excludes their own profile
- Images should display without blur
- Clicking a card navigates to `/matching/users/{userId}`

### Business Page
- `/business` is publicly accessible (no auth redirect)
- "新規出品" (new listing) button only appears for paid members
- Filter tabs: すべて / フリマ / 作品販売 / 講座レッスン

### Verifying Network Requests
The browser DevTools Network tab may not reliably capture requests made before it opens. Instead, use a fetch interceptor in the browser console:

```javascript
const origFetch = window.fetch;
window.__capturedRequests = [];
window.fetch = function(...args) {
  window.__capturedRequests.push(args[0]?.toString?.() || args[0]);
  return origFetch.apply(this, args);
};
```

Then trigger the request (e.g., switch tabs) and check `window.__capturedRequests`.

### Referral System
- `?ref=CODE` parameter saves to `carat_ref` cookie (30 days)
- Cookie is read during registration to link referral

### Founder Banner
- Fetches from `/api/founder/status` — if backend is unavailable, banner hides gracefully

## Notes
- No local backend is needed for most frontend testing (Vite proxy handles it)
- Login/paid-user testing requires real credentials or mocking `usePaidMember()` hook
- ECR Push (Docker build) can only be tested via CI, not locally
- The dev server port may vary; check for port conflicts if 5173/5174/5175 are in use

## Devin Secrets Needed
No secrets are required for anonymous user testing. Paid user testing would require valid login credentials (not currently available as saved secrets).
