// Utilities for extracting and generating embed URLs for external media services

// ── stand.fm ──────────────────────────────────────────────
// URL formats:
//   https://stand.fm/episodes/699bb68802f713695b794112
//   https://stand.fm/channels/xxxx/episodes/699bb68802f713695b794112
// Embed: https://stand.fm/embed/episodes/{episodeId}

export function extractStandFmUrl(text: string): string | null {
  if (!text) return null;
  const regex = /(https?:\/\/stand\.fm\/(?:channels\/[^/]+\/)?episodes\/[a-zA-Z0-9]+)/;
  const match = text.match(regex);
  return match ? match[1] : null;
}

export function getStandFmEmbedUrl(url: string): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    // Extract episode ID from various path formats
    const pathMatch = urlObj.pathname.match(/episodes\/([a-zA-Z0-9]+)/);
    if (pathMatch) {
      return `https://stand.fm/embed/episodes/${pathMatch[1]}`;
    }
  } catch {
    // ignore
  }
  return '';
}

// ── suno.ai / suno.com ───────────────────────────────────
// URL formats:
//   https://suno.com/song/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
//   https://www.suno.com/song/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
//   https://suno.com/s/m9FpHAvmG6AnosF7  (short share link)
//   https://suno.ai/song/...  (older domain)
// Embed: https://suno.com/embed/{songId}

export function extractSunoUrl(text: string): string | null {
  if (!text) return null;
  // Match /song/{id} or /s/{id} on suno.com or suno.ai
  const regex = /(https?:\/\/(?:www\.)?suno\.(?:com|ai)\/(?:song|s)\/[a-zA-Z0-9-]+)/;
  const match = text.match(regex);
  return match ? match[1] : null;
}

export function getSunoEmbedUrl(url: string): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    // Match both /song/{id} and /s/{id}
    const pathMatch = urlObj.pathname.match(/(?:song|s)\/([a-zA-Z0-9-]+)/);
    if (pathMatch) {
      return `https://suno.com/embed/${pathMatch[1]}`;
    }
  } catch {
    // ignore
  }
  return '';
}

// ── Combined detector ─────────────────────────────────────
export type EmbedType = 'standfm' | 'suno' | null;

export interface EmbedInfo {
  type: EmbedType;
  embedUrl: string;
  originalUrl: string;
}

export function detectExternalEmbed(text: string): EmbedInfo | null {
  if (!text) return null;

  const standFmUrl = extractStandFmUrl(text);
  if (standFmUrl) {
    const embedUrl = getStandFmEmbedUrl(standFmUrl);
    if (embedUrl) return { type: 'standfm', embedUrl, originalUrl: standFmUrl };
  }

  const sunoUrl = extractSunoUrl(text);
  if (sunoUrl) {
    const embedUrl = getSunoEmbedUrl(sunoUrl);
    if (embedUrl) return { type: 'suno', embedUrl, originalUrl: sunoUrl };
  }

  return null;
}
