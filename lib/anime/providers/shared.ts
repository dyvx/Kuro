/* Shared helpers for provider adapters. */

const MEDIA_EXT = /\.(m3u8|mp4|m4v|webm|mov)(\?|$)/i;

/**
 * Only direct media URLs are accepted. Iframe/embed pages are rejected so the
 * app stays ad-free — a server that only offers embeds is marked
 * "Embed / Unsupported" and omitted from the UI.
 */
export function isDirectMedia(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (MEDIA_EXT.test(url)) return true;
  // Some extractors return extensionless manifest URLs that are still direct
  // streams (e.g. segmentless HLS). Heuristic: reject obvious embed pages.
  const lower = url.toLowerCase();
  if (lower.includes("/embed") || lower.includes("/player") || lower.includes("/watch/")) {
    return /\.(m3u8|mp4)(\?|$)/i.test(url);
  }
  return false;
}

export function looksLikeEmbed(url: string | null | undefined): boolean {
  if (!url) return true;
  return !isDirectMedia(url);
}

export function mediaTypeOf(url: string): "hls" | "mp4" {
  return /\.m3u8(\?|$)/i.test(url) ? "hls" : "mp4";
}

/** Stable, tiny string hash for deterministic pseudo-random decisions. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mapRating(score: unknown): number | null {
  const n = typeof score === "string" ? parseFloat(score) : (score as number);
  if (!Number.isFinite(n)) return null;
  // AniList-style 0-100 scores become 0-10.
  return n > 10 ? Math.round(n) / 10 : Math.round(n * 10) / 10;
}
