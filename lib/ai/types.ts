/* ────────────────────────────────────────────────────────────────
   KURO AI — shared types
   Provider-agnostic AI assistant layer. No vendor names live here.
   ──────────────────────────────────────────────────────────────── */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** OpenAI-compatible tool-call blocks (assistant messages). */
  toolCalls?: ToolCallReq[];
  /** Tool identity for role==="tool" messages. */
  toolCallId?: string;
  name?: string;
}

export interface ToolCallReq {
  id: string;
  name: string;
  /** JSON-stringified arguments (wire format). */
  arguments: string;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  content: string;
}

/* ── Structured AI response (rendered by real KURO components) ── */

export interface AnimeResult {
  id: string;
  title: string;
  japaneseTitle?: string | null;
  thumbnail: string | null;
  description?: string;
  episodes?: number | null;
  rating?: number | null;
  year?: number | null;
  status?: string | null;
  type?: string | null;
  genres?: string[];
  /** Episode to resume, when the card represents "continue watching". */
  resumeEpisode?: number | null;
}

export type AIAction = {
  type: "view_anime";
  animeId: string;
} | {
  type: "play_anime";
  animeId: string;
  episode?: number;
};

export interface AIResponse {
  text: string;
  animeResults: AnimeResult[];
  actions: AIAction[];
}

/* ── Provider configuration (never exposes the API key) ── */

export type AIAdapterName = "openai-compatible";

export interface AISettings {
  enabled: boolean;
  providerName: string;
  adapter: AIAdapterName;
  baseUrl: string;
  /** Server-side only — never sent to the client. */
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  systemPromptOverride?: string;
}

/** Client-safe projection (masked). */
export interface AISettingsPublic {
  enabled: boolean;
  configured: boolean;
  providerName: string;
  adapter: AIAdapterName;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  hasApiKey: boolean;
  source: "env" | "database";
}
