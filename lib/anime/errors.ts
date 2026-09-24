import type { AnimeProvider } from "@/types/anime";

export class ProviderError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

export function isProviderConfigured(base: string | undefined | null): boolean {
  return typeof base === "string" && base.trim().length > 0;
}

/** Sanitize upstream HTML-ish description text. */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#?\w+);/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type { AnimeProvider };
