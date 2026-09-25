import { hasMongo, getDb } from "@/lib/db/mongo";
import type { AISettings, AISettingsPublic, AIAdapterName } from "./types";

/* ────────────────────────────────────────────────────────────────
   AI SETTINGS — fully configuration-driven, provider-agnostic.

   Precedence: database (admin-edited) > environment variables.
   The API key never leaves the server; clients only see a mask.
   ──────────────────────────────────────────────────────────────── */

const SETTINGS_COLLECTION = "ai_settings";
const SETTINGS_DOC_ID = "global";
/** Re-read DB overrides at most this often. */
const CACHE_MS = 15_000;

interface StoredAISettings extends Partial<AISettings> {
  updatedAt?: string;
}

let cache: { at: number; value: StoredAISettings | null } = { at: 0, value: null };

/* No Mongo (demo mode)? Admin edits apply in-process instead. */
let memoryOverride: StoredAISettings | null = null;

function envSettings(): AISettings {
  const temperature = Number(process.env.AI_TEMPERATURE);
  const maxTokens = Number(process.env.AI_MAX_TOKENS);
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS);
  return {
    enabled: (process.env.AI_ENABLED ?? "true").toLowerCase() !== "false",
    providerName: process.env.AI_PROVIDER_NAME || "Custom AI Provider",
    adapter: (process.env.AI_ADAPTER as AIAdapterName) || "openai-compatible",
    baseUrl: (process.env.AI_BASE_URL || "").replace(/\/+$/, ""),
    apiKey: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "",
    temperature: Number.isFinite(temperature) ? temperature : 0.7,
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? Math.floor(maxTokens) : 1024,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 5000 ? timeoutMs : 30_000,
  };
}

async function dbOverrides(): Promise<StoredAISettings | null> {
  if (!hasMongo()) return memoryOverride;
  if (Date.now() - cache.at < CACHE_MS) return cache.value;
  cache.at = Date.now();
  cache.value = null;
  try {
    const db = await getDb();
    const doc = await db.collection(SETTINGS_COLLECTION).findOne({ _id: SETTINGS_DOC_ID } as never);
    if (doc) {
      const { _id, ...rest } = doc as unknown as { _id: unknown } & StoredAISettings;
      cache.value = rest;
    }
  } catch {
    /* DB hiccups fall back to env silently */
  }
  return cache.value;
}

export async function getAISettings(): Promise<AISettings> {
  const base = envSettings();
  const ov = await dbOverrides();
  if (!ov) return base;
  return {
    enabled: typeof ov.enabled === "boolean" ? ov.enabled : base.enabled,
    providerName: ov.providerName ?? base.providerName,
    adapter: ov.adapter ?? base.adapter,
    baseUrl: (ov.baseUrl ?? base.baseUrl).replace(/\/+$/, ""),
    apiKey: ov.apiKey ?? base.apiKey,
    model: ov.model ?? base.model,
    temperature: typeof ov.temperature === "number" ? ov.temperature : base.temperature,
    maxTokens: typeof ov.maxTokens === "number" ? ov.maxTokens : base.maxTokens,
    timeoutMs: typeof ov.timeoutMs === "number" ? ov.timeoutMs : base.timeoutMs,
    systemPromptOverride: ov.systemPromptOverride ?? base.systemPromptOverride,
  };
}

export function isConfigured(s: AISettings): boolean {
  return Boolean(s.baseUrl && s.apiKey && s.model);
}

export async function saveAISettings(patch: Record<string, unknown>): Promise<void> {
  // Only persist sane, whitelisted fields.
  const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof patch.enabled === "boolean") clean.enabled = patch.enabled;
  if (typeof patch.providerName === "string" && patch.providerName.trim()) clean.providerName = patch.providerName.trim().slice(0, 60);
  if (patch.adapter === "openai-compatible") clean.adapter = patch.adapter;
  if (typeof patch.baseUrl === "string") clean.baseUrl = patch.baseUrl.trim().replace(/\/+$/, "").slice(0, 300);
  // Empty string means "keep current key"; a non-empty value replaces it.
  if (typeof patch.apiKey === "string" && patch.apiKey.length > 0) clean.apiKey = patch.apiKey.trim().slice(0, 300);
  if (typeof patch.model === "string") clean.model = patch.model.trim().slice(0, 120);
  if (typeof patch.temperature === "number" && patch.temperature >= 0 && patch.temperature <= 2) clean.temperature = patch.temperature;
  if (typeof patch.maxTokens === "number" && patch.maxTokens >= 64 && patch.maxTokens <= 8192) clean.maxTokens = Math.floor(patch.maxTokens);
  if (typeof patch.timeoutMs === "number" && patch.timeoutMs >= 5000 && patch.timeoutMs <= 120_000) clean.timeoutMs = Math.floor(patch.timeoutMs);
  if (typeof patch.systemPromptOverride === "string") clean.systemPromptOverride = patch.systemPromptOverride.slice(0, 4000);
  if (hasMongo()) {
    const db = await getDb();
    await db.collection(SETTINGS_COLLECTION).replaceOne(
      { _id: SETTINGS_DOC_ID } as never,
      clean as never,
      { upsert: true },
    );
    cache.at = 0;
  } else {
    memoryOverride = { ...(memoryOverride ?? {}), ...clean } as StoredAISettings;
  }
}

export function toPublic(s: AISettings): AISettingsPublic {
  return {
    enabled: s.enabled,
    configured: isConfigured(s),
    providerName: s.providerName,
    adapter: s.adapter,
    baseUrl: s.baseUrl,
    model: s.model,
    temperature: s.temperature,
    maxTokens: s.maxTokens,
    timeoutMs: s.timeoutMs,
    hasApiKey: Boolean(s.apiKey),
    source: "database",
  };
}

/* ── Admin gate: comma-separated emails in AI_ADMIN_EMAILS ── */

export function isAdminEmail(email?: string | null): boolean {
  const list = (process.env.AI_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length || !email) return false;
  return list.includes(email.toLowerCase());
}
