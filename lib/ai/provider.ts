import type { AISettings, ChatMessage } from "./types";

/* ────────────────────────────────────────────────────────────────
   AI PROVIDER SYSTEM — configuration-driven, zero vendor lock-in.

   AIProvider (interface)
    ├── OpenAICompatibleAdapter   POST {baseUrl}/chat/completions
    └── (future adapters plug in here)

   Adding an adapter: implement AIProvider and register it in
   ADAPTERS. Nothing else in the app may assume a vendor.
   ──────────────────────────────────────────────────────────────── */

export interface AIProviderRequest {
  messages: ChatMessage[];
  tools: unknown[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export interface AIProviderToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AIProviderResponse {
  text: string;
  toolCalls: AIProviderToolCall[];
  /** Raw finish reason for diagnostics. */
  finishReason?: string;
}

export interface AIProvider {
  readonly name: string;
  chat(req: AIProviderRequest): Promise<AIProviderResponse>;
}

/* ── Adapter: OpenAI-compatible /chat/completions ─────────────── */

export class OpenAICompatibleAdapter implements AIProvider {
  readonly name = "openai-compatible";

  constructor(private settings: AISettings) {}

  async chat(req: AIProviderRequest): Promise<AIProviderResponse> {
    const url = `${this.settings.baseUrl}/chat/completions`;
    const body = {
      model: this.settings.model,
      messages: req.messages.map(toWireMessage),
      tools: req.tools.length ? req.tools : undefined,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Standard auth header — the vast majority of OpenAI-compatible
        // providers accept this. Extra headers would belong to a dedicated
        // adapter, not to vendor-specific branches here.
        authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(req.timeoutMs),
    });

    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).slice(0, 300);
      throw new AIProviderError(`Provider responded ${res.status}`, { status: res.status, snippet });
    }

    const json = (await res.json().catch(() => null)) as
      | { choices?: { message?: WireMessage; finish_reason?: string }[] }
      | null;
    const choice = json?.choices?.[0];
    if (!choice?.message) {
      throw new AIProviderError("Provider returned an unexpected response shape");
    }
    return {
      text: choice.message.content ?? "",
      toolCalls: (choice.message.tool_calls ?? []).map((tc) => ({
        id: tc.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
        name: tc.function?.name ?? "",
        arguments: tc.function?.arguments ?? "{}",
      })),
      finishReason: choice.finish_reason,
    };
  }
}

export class AIProviderError extends Error {
  constructor(message: string, readonly details?: { status?: number; snippet?: string }) {
    super(message);
    this.name = "AIProviderError";
  }
}

/* ── Wire format (OpenAI-compatible message shape) ────────────── */

interface WireMessage {
  role: string;
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}

function toWireMessage(m: ChatMessage): WireMessage {
  const wire: WireMessage = { role: m.role, content: m.content || null };
  if (m.toolCalls?.length) {
    wire.tool_calls = m.toolCalls.map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.name, arguments: tc.arguments },
    }));
  }
  if (m.role === "tool") {
    wire.tool_call_id = m.toolCallId;
    wire.name = m.name;
    wire.content = m.content;
  }
  return wire;
}

/* ── Registry ─────────────────────────────────────────────────── */

const ADAPTERS: Record<string, (s: AISettings) => AIProvider> = {
  "openai-compatible": (s) => new OpenAICompatibleAdapter(s),
};

export function createAIProvider(settings: AISettings): AIProvider {
  const factory = ADAPTERS[settings.adapter];
  if (!factory) throw new AIProviderError(`Unknown AI adapter: ${settings.adapter}`);
  return factory(settings);
}
