import { createAIProvider, AIProviderError } from "./provider";
import { executeTool, toolSchemasFor, type ToolContext } from "./tools";
import { buildSystemPrompt } from "./prompts";
import { getMemory } from "./memory";
import { cleanSynopsis } from "@/lib/anime/synopsis";
import { getProvider } from "@/lib/anime/providers";
import { getStore } from "@/lib/db/store";
import type { AIResponse, AnimeResult, ChatMessage, AISettings } from "./types";

/* ────────────────────────────────────────────────────────────────
   ORCHESTRATOR
   Runs the tool loop: model → tools (validated, scoped) → model →
   … → final answer. presentAnime is intercepted server-side: card
   payloads are resolved from KURO's catalog, so the client only
   ever receives REAL anime data with working links.
   ──────────────────────────────────────────────────────────────── */

const MAX_ROUNDS = 3;
const MAX_HISTORY = 24;
const MAX_USER_CHARS = 2000;
const MAX_CARDS = 8;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RunOptions {
  settings: AISettings;
  messages: ConversationTurn[];
  userId: string | null;
  userName?: string | null;
}

function clampHistory(messages: ConversationTurn[]): ChatMessage[] {
  return messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.role === "user" ? m.content.slice(0, MAX_USER_CHARS) : m.content.slice(0, 4000),
    }));
}

/** Resolve real card payloads from the catalog — the anti-fabrication gate. */
async function resolveCards(animeIds: string[], userId: string | null, resume: boolean): Promise<AnimeResult[]> {
  const provider = getProvider();
  const unique = [...new Set(animeIds)].slice(0, MAX_CARDS);
  const results = await Promise.all(
    unique.map(async (id): Promise<AnimeResult | null> => {
      const d = await provider.getAnimeDetails(id).catch(() => null);
      if (!d) return null; // never fabricate
      let resumeEpisode: number | null = null;
      if (resume && userId) {
        const p = await getStore().getProgress(userId, id).catch(() => null);
        if (p && !p.completed) resumeEpisode = p.episodeNumber;
      }
      return {
        id: d.id,
        title: d.title,
        japaneseTitle: d.japaneseTitle ?? null,
        thumbnail: d.image ?? null,
        description: cleanSynopsis(d.description).slice(0, 180),
        episodes: d.totalEpisodes || d.episodes || null,
        rating: d.rating ?? null,
        year: d.year ?? null,
        status: d.status ?? null,
        type: d.type ?? null,
        genres: (d.genres ?? []).slice(0, 3),
        resumeEpisode,
      };
    }),
  );
  return results.filter((r): r is AnimeResult => r !== null);
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function runAIConversation(opts: RunOptions): Promise<AIResponse> {
  const { settings, userId, userName } = opts;
  const provider = createAIProvider(settings);
  const toolCtx: ToolContext = { userId };

  const memory = userId ? await getMemory(userId) : null;
  const system = buildSystemPrompt({
    settings,
    userName,
    signedIn: Boolean(userId),
    memory,
    providerName: getProvider().displayName,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...clampHistory(opts.messages),
  ];
  const tools = toolSchemasFor(userId);

  const cards: AnimeResult[] = [];
  let finalText = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await provider.chat({
      messages,
      tools,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      timeoutMs: settings.timeoutMs,
    });

    if (!res.toolCalls.length) {
      finalText = res.text.trim();
      break;
    }

    // Assistant turn with tool calls.
    messages.push({ role: "assistant", content: res.text ?? "", toolCalls: res.toolCalls });

    for (const call of res.toolCalls) {
      if (call.name === "presentAnime") {
        const args = safeParseArgs(call.arguments);
        const ids = Array.isArray(args.animeIds) ? args.animeIds.map((x) => String(x)).slice(0, MAX_CARDS) : [];
        const resume = args.resume === true;
        const resolved = await resolveCards(ids, userId, resume);
        cards.push(...resolved.filter((c) => !cards.some((e) => e.id === c.id)));
        const missing = ids.filter((id) => !resolved.some((c) => c.id === id));
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify({
            presented: resolved.map((c) => ({ id: c.id, title: c.title, resumeEpisode: c.resumeEpisode ?? null })),
            rejected: missing,
            note: missing.length ? "Rejected ids were not found in KURO's catalog — do not mention them as results." : "Cards are attached to your reply.",
          }),
        });
        continue;
      }

      const { json } = await executeTool(call.name, safeParseArgs(call.arguments), toolCtx);
      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        // Keep tool payloads lean.
        content: JSON.stringify(json).slice(0, 6000),
      });
    }

    finalText = res.text.trim(); // fallback if the loop ends on tool rounds
  }

  // Build actions from presented cards (real, working routes only).
  const actions = cards.flatMap<AIResponse["actions"][number]>((c) => [
    { type: "view_anime", animeId: c.id },
    {
      type: "play_anime",
      animeId: c.id,
      episode: c.resumeEpisode ?? 1,
    },
  ]);

  return {
    text: finalText || "Here's what I found on KURO.",
    animeResults: cards,
    actions,
  };
}

export { AIProviderError };
