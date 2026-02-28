"""OGP (Open Graph Protocol) metadata proxy endpoint.

Fetches og:image, og:title, og:description from a given URL so the
frontend can render a rich link preview without running into CORS issues.
"""

import httpx
import re
from html import unescape
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/ogp", tags=["ogp"])

_TIMEOUT = 8.0  # seconds
_MAX_BYTES = 512_000  # only read first ~500 KB to find <head> tags


def _extract_meta(html: str, property_name: str) -> str | None:
    """Extract content from <meta property="..." content="..."> or <meta name="..." content="...">."""
    # Try property= first (OGP standard), then name= (Twitter cards, etc.)
    for attr in ("property", "name"):
        pattern = rf'<meta\s+[^>]*{attr}=["\']?{re.escape(property_name)}["\']?\s+[^>]*content=["\']([^"\']*)["\']'
        m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
        if m:
            return unescape(m.group(1)).strip()
        # Also match content= before property= (attribute order varies)
        pattern2 = rf'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*{attr}=["\']?{re.escape(property_name)}["\']?'
        m2 = re.search(pattern2, html, re.IGNORECASE | re.DOTALL)
        if m2:
            return unescape(m2.group(1)).strip()
    return None


def _extract_title(html: str) -> str | None:
    """Fallback: extract <title> tag."""
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    return unescape(m.group(1)).strip() if m else None


@router.get("")
async def get_ogp(url: str = Query(..., description="URL to fetch OGP metadata from")):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL")

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=_TIMEOUT,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; CaratBot/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            },
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()

            # Only read first N bytes
            html = resp.text[:_MAX_BYTES]

    except Exception:
        raise HTTPException(status_code=502, detail="Failed to fetch URL")

    og_title = _extract_meta(html, "og:title") or _extract_title(html)
    og_description = _extract_meta(html, "og:description") or _extract_meta(html, "description")
    og_image = _extract_meta(html, "og:image") or _extract_meta(html, "twitter:image")
    og_site_name = _extract_meta(html, "og:site_name")

    # Resolve relative og:image URLs
    if og_image and not og_image.startswith(("http://", "https://")):
        from urllib.parse import urljoin
        og_image = urljoin(url, og_image)

    return JSONResponse(
        content={
            "title": og_title or "",
            "description": og_description or "",
            "image": og_image or "",
            "site_name": og_site_name or "",
            "url": url,
        },
        headers={"Cache-Control": "public, max-age=86400"},  # cache 24h
    )
