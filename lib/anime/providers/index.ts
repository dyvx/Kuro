import type { AnimeProvider, ProviderId } from "@/types/anime";
import { ProviderError, isProviderConfigured } from "../errors";
import { demoProvider } from "./demo";
import { anivexaProvider } from "./anivexa";

/* ────────────────────────────────────────────────────────────────
   PROVIDER REGISTRY
   The UI only ever talks to `getProvider()`. Switching upstreams is
   a pure env-var change — no component edits required.

     ANIME_PROVIDER=demo     → bundled offline catalog (default)
     ANIME_PROVIDER=anivexa  → your Anivexa instance (ANIME_API_BASE_URL)

   Kuhi is NOT a metadata provider — it is an additional STREAM source
   inside the Anivexa adapter (ANIME_KUHI_BASE_URL, streaming only).

   (Consumet/Anify adapters removed — APIs defunct, see git history.)
   ──────────────────────────────────────────────────────────────── */

const registry: Record<ProviderId, AnimeProvider> = {
  demo: demoProvider,
  anivexa: anivexaProvider,
};

export function currentProviderId(): ProviderId {
  const raw = (process.env.ANIME_PROVIDER ?? "demo").toLowerCase();
  return (["demo", "anivexa"] as const).includes(raw as ProviderId)
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
