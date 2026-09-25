/**
 * Clean provider synopses for display.
 * AniList (and similar) return raw-ish HTML: literal <br>/<i>/<b> tags,
 * numeric HTML entities, and ~!spoiler!~ markers. Strip them all so the
 * details page and hero never show markup junk.
 */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "\u2019",
  lsquo: "\u2018",
  ldquo: "\u201c",
  rdquo: "\u201d",
};

export function cleanSynopsis(raw?: string | null): string {
  if (!raw) return "";
  return raw
    // spoilers: ~!text!~ or |text| → just drop the markers, keep the text
    .replace(/~!/g, "")
    .replace(/!~/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(i|b|em|strong|p|span)[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_m, code: string) => {
      const n = Number(code);
      return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    // collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
