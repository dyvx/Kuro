"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowUp, Bot, Eraser, RotateCw, ShieldCheck, Sparkles, SquarePlus, TriangleAlert } from "lucide-react";
import { AiMessage, type ChatEntry } from "./ai-message";
import { cn } from "@/utils/cn";

/* ────────────────────────────────────────────────────────────────
   KURO AI — native page, not a widget. History persists locally;
   memory lives server-side per user and is clearable any time.
   ──────────────────────────────────────────────────────────────── */

const STORAGE_KEY = "kuro-ai-chat:v1";

const SUGGESTIONS = [
  { icon: "🔎", label: "Is Solo Leveling available?", prompt: "Is Solo Leveling available on KURO?" },
  { icon: "💪", label: "Insanely OP MC anime", prompt: "Give me some insanely OP MC anime." },
  { icon: "🍿", label: "What should I watch next?", prompt: "What should I watch next?" },
  { icon: "▶️", label: "Continue what I was watching", prompt: "Continue what I was watching." },
  { icon: "🌑", label: "Dark psychological anime", prompt: "Find dark psychological anime." },
];

interface Capability {
  enabled: boolean;
  configured: boolean;
  providerName: string;
  signedIn: boolean;
}

let nextId = 1;

function loadStored(): ChatEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && (e.role === "user" || e.role === "assistant") && typeof e.text === "string")
      .slice(-24)
      .map((e) => ({ ...e, id: `${Date.now()}-${nextId++}` }));
  } catch {
    return [];
  }
}

export function AIClient() {
  const { status } = useSession();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [cap, setCap] = useState<Capability | null>(null);
  const [confirmClearMemory, setConfirmClearMemory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const signedIn = status === "authenticated";

  /* boot: capability probe + stored conversation */
  useEffect(() => {
    setEntries(loadStored());
    fetch("/api/ai/chat")
      .then((r) => r.json())
      .then((json: Capability) => setCap(json))
      .catch(() => setCap({ enabled: false, configured: false, providerName: "AI", signedIn: false }));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-24)));
    } catch {
      /* storage full/blocked — chat still works in-memory */
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, sending]);

  const autosize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 132)}px`;
  }, []);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || sending) return;
      const userEntry: ChatEntry = { id: `u${nextId++}`, role: "user", text };
      const aiId = `a${nextId++}`;
      setEntries((prev) => [
        ...prev,
        userEntry,
        { id: aiId, role: "assistant", text: "", cards: [] },
      ]);
      setInput("");
      if (taRef.current) taRef.current.style.height = "auto";
      setSending(true);

      try {
        const history = [...entries, userEntry].map((e) => ({ role: e.role, content: e.text }));
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (res.ok) {
          const json = (await res.json()) as { message: { text: string; animeResults: ChatEntry["cards"] } };
          setEntries((prev) =>
            prev.map((e) =>
              e.id === aiId
                ? { ...e, text: json.message.text || "", cards: json.message.animeResults ?? [] }
                : e,
            ),
          );
        } else {
          const code = ((await res.json().catch(() => ({}))) as { code?: string }).code;
          const kind: ChatEntry["error"] =
            code === "not_configured" ? "configured" : code === "rate_limited" ? "rate_limited" : code === "not_signed_in" ? "auth" : "provider";
          setEntries((prev) => prev.map((e) => (e.id === aiId ? { ...e, text: "", error: kind } : e)));
        }
      } catch {
        setEntries((prev) => prev.map((e) => (e.id === aiId ? { ...e, text: "", error: "provider" } : e)));
      } finally {
        setSending(false);
      }
    },
    [entries, input, sending],
  );

  const retryLast = useCallback(() => {
    const lastUser = [...entries].reverse().find((e) => e.role === "user");
    if (lastUser) {
      setEntries((prev) => {
        const idx = prev.map((e) => e.role).lastIndexOf("user");
        return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
      });
      void send(lastUser.text);
    }
  }, [entries, send]);

  const clearMemory = useCallback(async () => {
    if (!confirmClearMemory) {
      setConfirmClearMemory(true);
      setTimeout(() => setConfirmClearMemory(false), 3500);
      return;
    }
    setConfirmClearMemory(false);
    await fetch("/api/ai/memory", { method: "DELETE" }).catch(() => {});
    setEntries((prev) => [
      ...prev,
      { id: `a${nextId++}`, role: "assistant", text: "Done — I've cleared your AI memory. Fresh start. 🖤" },
    ]);
  }, [confirmClearMemory]);

  const hasChat = entries.length > 0;
  const notConfigured = cap !== null && (!cap.enabled || !cap.configured);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
      {/* ── header ── */}
      <header className="sticky top-16 z-30 -mx-4 border-b border-line/60 bg-ink-950/85 px-4 py-3 backdrop-blur-lg sm:mx-0 sm:rounded-b-3xl sm:border-x sm:px-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow-sm" aria-hidden>
            <Bot className="h-5 w-5 text-white" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-emerald-400" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-display text-lg font-bold leading-tight text-txt">
              KURO AI
              <Sparkles className="h-3.5 w-3.5 text-primary-300" aria-hidden />
            </h1>
            <p className="truncate text-[11px] text-txt-faint">
              {notConfigured
                ? "Not configured yet"
                : cap
                  ? `Powered by ${cap.providerName} · knows your KURO library`
                  : "Connecting…"}
            </p>
          </div>
          {hasChat && (
            <button
              onClick={() => setEntries([])}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-txt-muted transition-colors hover:border-primary-400/50 hover:text-primary-200"
            >
              <SquarePlus className="h-3.5 w-3.5 rotate-90" aria-hidden />
              <span className="hidden sm:inline">New chat</span>
            </button>
          )}
          {signedIn && (
            <button
              onClick={clearMemory}
              aria-label="Clear AI memory"
              title="Clear AI memory"
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors",
                confirmClearMemory
                  ? "border-crimson-500/60 bg-crimson-500/15 text-crimson-300"
                  : "border-line text-txt-muted hover:border-crimson-400/50 hover:text-crimson-300"
              )}
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{confirmClearMemory ? "Sure?" : "Clear memory"}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── conversation ── */}
      <div className="min-h-0 flex-1 px-4 py-5 sm:px-0" aria-live="polite">
        {notConfigured && (
          <div className="mx-auto mb-5 flex max-w-xl items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              <span className="font-bold">KURO AI isn&apos;t configured yet.</span>{" "}
              Set <code className="rounded bg-white/10 px-1">AI_BASE_URL</code>,{" "}
              <code className="rounded bg-white/10 px-1">AI_API_KEY</code> and{" "}
              <code className="rounded bg-white/10 px-1">AI_MODEL</code> (or use Profile → AI Settings as admin).
            </p>
          </div>
        )}

        {!hasChat ? (
          <div className="mx-auto max-w-xl pt-4 text-center sm:pt-10">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-gradient shadow-glow" aria-hidden>
              <Bot className="h-8 w-8 text-white" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold text-txt sm:text-3xl">
              Your anime has a brain now.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-txt-muted">
              Ask me anything about KURO — I search the real catalog, know what you&apos;re watching,
              and remember what you love. {signedIn ? "" : "Sign in to unlock history, watchlist and memory."}
            </p>
            <div className="mt-7 grid gap-2.5 text-left sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.prompt}
                  onClick={() => void send(s.prompt)}
                  disabled={notConfigured || sending}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-3.5 text-sm font-semibold text-txt-muted transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:border-primary-400/50 hover:bg-surface-raised hover:text-txt disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="text-base" aria-hidden>{s.icon}</span>
                  <span className="min-w-0 flex-1">{s.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-txt-faint">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Only you can access your data. Memory is minimal and clearable anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {entries.map((e) => (
              <AiMessage key={e.id} entry={e} />
            ))}
            {sending && (
              <div className="flex justify-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-400/40 bg-primary-500/15 text-primary-300" aria-hidden>
                  <Bot className="h-4 w-4" />
                </span>
                <div className="glass rounded-3xl rounded-bl-lg px-4 py-3.5">
                  <span className="flex gap-1.5" aria-label="KURO AI is thinking">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 animate-bounce rounded-full bg-primary-400/80"
                        style={{ animationDelay: `${i * 140}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── composer ── */}
      <div className="sticky bottom-0 z-30 -mx-4 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+76px)] pt-3 sm:mx-0 sm:rounded-t-3xl sm:px-0 md:pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="glass flex items-end gap-2 rounded-3xl p-2 shadow-card-lg"
        >
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autosize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={notConfigured ? "Configure KURO AI first…" : "Ask about anime, your history, what to watch…"}
            aria-label="Message KURO AI"
            disabled={notConfigured || sending}
            maxLength={2000}
            className="max-h-[132px] min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-txt placeholder:text-txt-faint outline-none disabled:opacity-50"
          />
          {sending ? (
            <button
              type="button"
              onClick={retryLast}
              aria-label="Stop and retry"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line text-txt-muted transition-colors hover:text-txt"
            >
              <RotateCw className="h-4.5 w-4.5" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || notConfigured}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow-sm transition-all duration-200 hover:brightness-110 active:scale-90 disabled:opacity-35 disabled:shadow-none"
            >
              <ArrowUp className="h-5 w-5" aria-hidden />
            </button>
          )}
        </form>
        <p className="mt-1.5 text-center text-[10px] text-txt-faint">
          KURO AI answers from the real catalog & your library — availability always verified.
        </p>
      </div>
    </div>
  );
}
