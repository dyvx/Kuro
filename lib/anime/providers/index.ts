import type { AnimeProvider, ProviderId } from "@/types/anime";
import { ProviderError, isProviderConfigured } from "../errors";
import { demoProvider } from "./demo";
import { consumetProvider } from "./consumet";
import { anifyProvider } from "./anify";
import { anivexaProvider } from "./anivexa";

/* ────────────────────────────────────────────────────────────────
   PROVIDER REGISTRY
   The UI only ever talks to `getProvider()`. Switching upstreams is
   a pure env-var change — no component edits required.

     ANIME_PROVIDER=demo      → bundled offline catalog (default)
     ANIME_PROVIDER=consumet  → your Consumet instance (ANIME_API_BASE_URL)
     ANIME_PROVIDER=anify     → Anify API (ANIME_API_BASE_URL, optional key)
   ──────────────────────────────────────────────────────────────── */

const registry: Record<ProviderId, AnimeProvider> = {
  demo: demoProvider,
  consumet: consumetProvider,
  anify: anifyProvider,
  anivexa: anivexaProvider,
};

export function currentProviderId(): ProviderId {
  const raw = (process.env.ANIME_PROVIDER ?? "demo").toLowerCase();
  return (["demo", "consumet", "anify", "anivexa"] as const).includes(raw as ProviderId)
    ? (raw as ProviderId)
    : "demo";
}

export function getProvider(): AnimeProvider {
  const id = currentProviderId();
  if (id === "demo") return demoProvider;
  if (!isProviderConfigured(process.env.ANIME_API_BASE_URL)) {
    console.warn(
      `[kuro] ANIME_PROVIDER=${id} but ANIME_API_BASE_URL is empty — falling back to demo catalog.`
    );
    return demoProvider;
  }
  return registry[id];
}

export function getProviderDisplay(): { id: ProviderId; name: string; demo: boolean } {
  const provider = getProvider();
  return {
    id: provider.id,
    name: provider.displayName,
    demo: provider.id === "demo",
  };
}

export { ProviderError };
