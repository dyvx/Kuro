"use client";

import Link from "next/link";
import { Bot, User } from "lucide-react";
import { AnimeResultCard } from "./anime-result-card";
import type { AnimeResult } from "@/lib/ai/types";

/* ────────────────────────────────────────────────────────────────
   AI message renderer — tiny, safe markdown (no HTML injection):
   headings, bullets, bold/italic/inline-code, internal links.
   Anime cards are real KURO components fed by server-verified data.
   ──────────────────────────────────────────────────────────────── */

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards?: AnimeResult[];
  /** UI-level failure attached to this assistant turn. */
  error?: "provider" | "configured" | "rate_limited" | "auth";
}

/** Inline formatting: **bold**, *italic*, `code`, [label](/internal). */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\(\/[^)\s]*\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-i${i++}`;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key} className="font-bold text-txt">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded-md border border-line bg-white/[0.06] px-1.5 py-0.5 text-[0.85em] font-semibold text-primary-200">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      const href = tok.slice(tok.indexOf("](") + 2, -1);
      nodes.push(
        <Link key={key} href={href} className="font-semibold text-primary-300 underline-offset-4 hover:underline">
          {label}
        </Link>,
      );
    } else {
      nodes.push(<em key={key} className="italic">{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function MarkdownLite({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const segments = text.split(/```(?:[a-z]*\n)?([\s\S]*?)```/g); // odd = code
  segments.forEach((seg, si) => {
    if (si % 2 === 1) {
      blocks.push(
        <pre key={`c${si}`} className="scrollbar-none my-2 overflow-x-auto rounded-xl border border-line bg-black/50 p-3 text-xs leading-relaxed text-txt-muted">
          <code>{seg.replace(/\n$/, "")}</code>
        </pre>,
      );
      return;
    }
    const lines = seg.split("\n");
    let bullets: string[] = [];
    const flush = (key: string) => {
      if (!bullets.length) return;
      blocks.push(
        <ul key={key} className="my-1.5 space-y-1 pl-1">
          {bullets.map((b, bi) => (
            <li key={bi} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400/70" aria-hidden />
              <span>{renderInline(b, `${key}-${bi}`)}</span>
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    };
    lines.forEach((line, li) => {
      const t = line.trim();
      const key = `s${si}-l${li}`;
      if (/^[-*]\s+/.test(t)) {
        bullets.push(t.replace(/^[-*]\s+/, ""));
        return;
      }
      flush(`${key}-ul`);
      if (!t) return;
      const h = /^(#{1,3})\s+(.*)$/.exec(t);
      if (h) {
        blocks.push(
          <p key={key} className="mt-3 mb-1 text-sm font-bold text-txt">
            {renderInline(h[2], key)}
          </p>,
        );
        return;
      }
      blocks.push(
        <p key={key} className="my-0.5 text-sm leading-relaxed">
          {renderInline(t, key)}
        </p>,
      );
    });
    flush(`s${si}-ul-end`);
  });
  return <div className="min-w-0">{blocks}</div>;
}

export function AiMessage({ entry }: { entry: ChatEntry }) {
  const isUser = entry.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium leading-relaxed text-white shadow-glow-sm">
          {entry.text}
        </div>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-crimson-500 text-white" aria-hidden>
          <User className="h-4 w-4" />
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-400/40 bg-primary-500/15 text-primary-300" aria-hidden>
        <Bot className="h-4 w-4" />
      </span>
      <div className="min-w-0 max-w-[92%] flex-1 space-y-2.5">
        <div className="glass w-fit max-w-full rounded-3xl rounded-bl-lg px-4 py-3">
          {entry.text ? (
            <MarkdownLite text={entry.text} />
          ) : entry.cards?.length ? null : (
            <span className="flex gap-1.5 py-1" aria-label="KURO AI is thinking">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-primary-400/80"
                  style={{ animationDelay: `${i * 140}ms` }}
                />
              ))}
            </span>
          )}
        </div>

        {entry.cards && entry.cards.length > 0 && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {entry.cards.map((c) => (
              <AnimeResultCard key={c.id} anime={c} />
            ))}
          </div>
        )}

        {entry.error && (
          <div
            role="alert"
            className="rounded-2xl border border-crimson-500/25 bg-crimson-500/[0.06] px-4 py-3 text-sm text-crimson-200"
          >
            {entry.error === "configured"
              ? "KURO AI isn't configured yet. An administrator can set it up in Profile → AI Settings."
              : entry.error === "rate_limited"
                ? "You're sending messages a little too fast — take a short breather and try again."
                : entry.error === "auth"
                  ? "Please sign in to chat with KURO AI."
                  : "The AI provider couldn't be reached. It may be down or misconfigured — try again in a moment."}
          </div>
        )}
      </div>
    </div>
  );
}
