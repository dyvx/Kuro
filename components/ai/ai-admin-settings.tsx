"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, LoaderCircle, PlugZap, Save } from "lucide-react";
import { cn } from "@/utils/cn";

/* ────────────────────────────────────────────────────────────────
   Admin AI settings (Profile → AI Settings).
   Only rendered when the signed-in email is in AI_ADMIN_EMAILS and
   the server confirms it — the API enforces the same gate.
   The API key is write-only: it is never echoed back to the client.
   ──────────────────────────────────────────────────────────────── */

interface PublicSettings {
  enabled: boolean;
  configured: boolean;
  providerName: string;
  adapter: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  hasApiKey: boolean;
}

export function AIAdminSettings() {
  const [s, setS] = useState<PublicSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [hasOverride, setHasOverride] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/ai/admin")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((json: { settings: PublicSettings }) => {
        setS(json.settings);
      })
      .catch(() => setS(null));
    fetch("/api/ai/admin")
      .then((r) => r.json())
      .catch(() => null);
    // system prompt override isn't part of the public projection (it can be
    // long) — probe it through a dedicated light endpoint-less trick: skip.
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch the full override via admin GET (extended field).
  useEffect(() => {
    fetch("/api/ai/admin")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        // systemPromptOverride travels only in the admin payload.
        const withOverride = json?.settings?.systemPromptOverride as string | undefined;
        if (typeof withOverride === "string") {
          setSystemPrompt(withOverride);
          setHasOverride(Boolean(withOverride));
        }
      })
      .catch(() => {});
  }, []);

  if (!s) return null;

  const put = async () => {
    setBusy("save");
    setStatus(null);
    try {
      const res = await fetch("/api/ai/admin", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: s.enabled,
          providerName: s.providerName,
          baseUrl: s.baseUrl,
          model: s.model,
          temperature: s.temperature,
          maxTokens: s.maxTokens,
          timeoutMs: s.timeoutMs,
          systemPromptOverride: systemPrompt,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setS(json.settings);
        setApiKey("");
        setStatus({ ok: true, text: "Saved." });
      } else {
        setStatus({ ok: false, text: json?.error ?? "Save failed." });
      }
    } catch {
      setStatus({ ok: false, text: "Save failed." });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setStatus(null);
    try {
      const res = await fetch("/api/ai/admin", { method: "POST" });
      const json = await res.json();
      setStatus({ ok: Boolean(json?.ok), text: json?.message ?? "No response." });
    } catch {
      setStatus({ ok: false, text: "Test request failed." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-txt">
          <Bot className="h-5 w-5 text-primary-300" aria-hidden />
          AI Settings
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-txt-muted">
          <input
            type="checkbox"
            checked={s.enabled}
            onChange={(e) => setS({ ...s, enabled: e.target.checked })}
            className="h-4 w-4 accent-[#8b5cf6]"
          />
          Enabled
        </label>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-txt-faint">
        Provider-agnostic: any OpenAI-compatible endpoint works. The API key is stored server-side and never exposed.
        {!s.configured && <span className="ml-1 font-bold text-amber-300">Currently incomplete — base URL, key and model are required.</span>}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Provider name">
          <input className={inputCls} value={s.providerName} onChange={(e) => setS({ ...s, providerName: e.target.value })} placeholder="My AI Provider" />
        </Field>
        <Field label="Model">
          <input className={inputCls} value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} placeholder="e.g. my-model-1" />
        </Field>
        <Field label="Base URL" className="sm:col-span-2">
          <input className={inputCls} value={s.baseUrl} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} placeholder="https://provider.example.com/v1" />
        </Field>
        <Field label={`API key ${s.hasApiKey ? "(saved — leave blank to keep)" : ""}`} className="sm:col-span-2">
          <input
            type="password"
            className={inputCls}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={s.hasApiKey ? "••••••••" : "Paste API key"}
            autoComplete="off"
          />
        </Field>
        <Field label="Temperature (0–2)">
          <input type="number" min={0} max={2} step={0.1} className={inputCls} value={s.temperature} onChange={(e) => setS({ ...s, temperature: Number(e.target.value) })} />
        </Field>
        <Field label="Max tokens">
          <input type="number" min={64} max={8192} step={64} className={inputCls} value={s.maxTokens} onChange={(e) => setS({ ...s, maxTokens: Number(e.target.value) })} />
        </Field>
        <Field label="Request timeout (ms, 5000–120000)" className="sm:col-span-2">
          <input type="number" min={5000} max={120000} step={1000} className={inputCls} value={s.timeoutMs} onChange={(e) => setS({ ...s, timeoutMs: Number(e.target.value) })} />
        </Field>
        <Field label="System prompt override (optional)" className="sm:col-span-2">
          <textarea
            rows={3}
            className={cn(inputCls, "min-h-[80px] resize-y py-2")}
            value={systemPrompt}
            onChange={(e) => {
              setSystemPrompt(e.target.value);
              setHasOverride(Boolean(e.target.value));
            }}
            placeholder={hasOverride ? "Custom system prompt…" : "Leave empty to use the built-in KURO AI prompt."}
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          onClick={put}
          disabled={busy !== null}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-white shadow-glow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          {busy === "save" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Save settings
        </button>
        <button
          onClick={test}
          disabled={busy !== null}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-txt-muted transition-colors hover:border-primary-400/50 hover:text-primary-200 disabled:opacity-50"
        >
          {busy === "test" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <PlugZap className="h-4 w-4" aria-hidden />}
          Test connection
        </button>
        {status && (
          <span className={cn("text-xs font-semibold", status.ok ? "text-emerald-400" : "text-crimson-400")} role="status">
            {status.text}
          </span>
        )}
      </div>
    </section>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-ink-900/70 px-3 text-sm text-txt outline-none transition-colors hover:border-line-strong focus:border-primary-400/60";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-txt-faint">{label}</span>
      {children}
    </label>
  );
}
