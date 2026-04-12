# Carat Community Frontend Testing

## Environment Setup

1. Install frontend dependencies: `cd frontend && npm install`
2. Start dev server: `npx vite --host 0.0.0.0 --port 5174` (port may increment if in use)
3. The Vite dev server proxies `/api` requests to the production backend at `https://ddxdewgmen.ap-northeast-1.awsapprunner.com`
4. No backend setup needed locally for frontend-only testing

## Devin Secrets Needed

No secrets required for frontend testing. The dev server proxies to production backend.

## Testing Patterns

### Playwright CDP Mocking (Recommended for API-dependent flows)

When testing frontend logic that depends on API responses (e.g., verify-email redirect behavior), use Playwright via CDP to intercept network requests. This avoids creating real users in production.

```python
from playwright.async_api import async_playwright
import json

async with async_playwright() as p:
    browser = await p.chromium.connect_over_cdp("http://localhost:29229")
    context = browser.contexts[0]
    page = await context.new_page()
    
    # Set up route interception BEFORE navigating
    async def mock_api(route):
        await route.fulfill(
            status=200,
            content_type='application/json',
            body=json.dumps({"status": "verified", ...})
        )
    
    await page.route('**/api/endpoint**', mock_api)
    await page.goto('http://localhost:5174/page')
```

**Important**: Browser console `fetch` overrides do NOT persist across page navigations. Always use Playwright route interception for mocking API responses on pages that call APIs on mount.

### Browser Console (For non-navigation testing)

Use browser console for:
- Checking URL params: `new URL(window.location.href).searchParams.get('ref')`
- Inspecting localStorage state
- Verifying DOM content

Do NOT use for:
- Mocking fetch responses on pages that auto-call APIs on mount (mock is lost on navigation)

## Architecture Notes

### Referral URL Handling

The referral flow uses two components:
- `HomeRedirect` (in `App.tsx`): Route-level component on `/` that checks `?ref=` query param. If ref exists and user not logged in, redirects to `/subscribe?ref=...`. Otherwise redirects to `/feed`. This runs synchronously during render.
- `ReferralTracker` (invisible component): Captures ref code from URL and saves to cookie. Does NOT handle redirects (that responsibility moved to `HomeRedirect` to avoid React Router race conditions).

**Key lesson**: Never use `useEffect` for redirects that compete with React Router's `<Navigate>`. Route-level components that run during render are the correct pattern.

### Cannot Test Full Registration Flow

The dev server proxies to production backend. Submitting registration forms will create real users in the production database and send real verification emails. Test frontend logic (redirects, form behavior, API payload construction) without actually submitting forms.

## Key Pages & Flows

- `/?ref=CODE` → Redirected to `/subscribe?ref=CODE` by `HomeRedirect` (non-logged-in users)
- `/subscribe?ref=CODE` - Registration form, extracts ref from URL or cookie
- `/verify-email?token=TOKEN` - Email verification, checks `is_founder_free_member` flag for conditional redirect
- `/email-verification-pending` - Waiting page after registration
- `/kyc-verification` - KYC page (normal paid users go here after email verification)
- `/feed` - Home page (founder_free users skip KYC and go here directly)
