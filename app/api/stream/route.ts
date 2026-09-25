export const dynamic = "force-dynamic";
// Video segments route through here; allow time for slow upstream CDNs.
export const maxDuration = 60;

/* ────────────────────────────────────────────────────────────────
   STREAM PROXY
   Many provider CDNs lock CORS to their own embed player and serve
   decoy responses to other origins, so the browser cannot fetch the
   media directly — even when server-side extraction succeeded.

   This proxy fetches manifests/segments server-side (no CORS applies
   server-to-server) with the Referer the provider told us to use,
   rewrites playlist URLs to stay inside the proxy, and pipes the
   bytes to the player from our own origin. Result: playback works
   without iframes and without ads (spec §5).
   ──────────────────────────────────────────────────────────────── */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function proxied(abs: string, referer: string): string {
  return `/api/stream?u=${encodeURIComponent(abs)}&r=${encodeURIComponent(referer)}`;
}

/** Rewrite every URI inside an HLS playlist to route through the proxy. */
function rewriteManifest(text: string, base: URL, referer: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        // EXT-X-MEDIA / EXT-X-MAP / EXT-X-KEY / I-FRAME playlists carry URI="…"
        return trimmed.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
          try {
            return `URI="${proxied(new URL(uri, base).toString(), referer)}"`;
          } catch {
            return _m;
          }
        });
      }
      try {
        return proxied(new URL(trimmed, base).toString(), referer);
      } catch {
        return line;
      }
    })
    .join("\n");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("u") ?? "";
  const referer = searchParams.get("r") ?? "";

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new Response("Bad stream url", { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return new Response("Bad stream protocol", { status: 400 });
  }
  // Only proxy media-ish hosts — this is not an open web proxy.
  if (target.pathname.startsWith("/api/")) {
    return new Response("Refused", { status: 400 });
  }

  const upstreamHeaders: Record<string, string> = {
    "user-agent": BROWSER_UA,
    accept: "*/*",
  };
  if (referer) {
    upstreamHeaders.referer = referer;
    try {
      const o = new URL(referer);
      upstreamHeaders.origin = o.origin;
    } catch {
      /* ignore bad referer */
    }
  }
  // Progressive files (mp4): let the CDN honor byte ranges so the player
  // can seek without downloading the whole file.
  const clientRange = req.headers.get("range");
  if (clientRange) upstreamHeaders.range = clientRange;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: upstreamHeaders,
      cache: "no-store",
      redirect: "follow",
    });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream error ${upstream.status}`, { status: 502 });
  }

  // Resolve relative URIs against the FINAL url (redirects may move hosts).
  let base = target;
  try {
    if (upstream.url) base = new URL(upstream.url);
  } catch {
    /* keep original target */
  }

  const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();

  // Provider CDNs mislabel payloads (real playlists arrive as image/jpeg),
  // so sniff the first bytes instead of trusting headers.
  // NOTE: body.tee() + partial cancel hangs on undici streams — buffer the
  // first chunks manually and replay them when piping binaries.
  const body = upstream.body;
  if (!body) {
    return new Response("Upstream sent no body", { status: 502 });
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let buffered = 0;
  try {
    while (buffered < 1024) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      buffered += value.byteLength;
    }
  } catch {
    /* upstream died mid-sniff — decide on what we have */
  }

  let headText = "";
  let filled = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, 1024 - filled);
    headText += new TextDecoder("utf-8", { fatal: false }).decode(chunk.subarray(0, take));
    filled += take;
    if (filled >= 1024) break;
  }
  const sniffStart = headText.trimStart();
  const mpegTs =
    buffered >= 188 && headText.charCodeAt(0) === 0x47 && headText.charCodeAt(188) === 0x47;
  const mp4 = headText.slice(4, 8) === "ftyp";

  if (sniffStart.startsWith("#EXTM3U") || contentType.includes("mpegurl")) {
    // Playlists are tiny — finish reading fully, rewrite every URI.
    let text = headText;
    const decoder = new TextDecoder("utf-8", { fatal: false });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    // Decoy detection: some CDNs answer strangers with images/HTML.
    if (!text.includes("#EXTM3U")) {
      return new Response("Upstream returned a non-manifest response", { status: 502 });
    }
    return new Response(rewriteManifest(text, base, referer), {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "private, max-age=2",
      },
    });
  }

  // Decoy guard: HTML error pages / images where media should be.
  const looksHtml = /^\s*<(!doctype|html|\?xml)/i.test(sniffStart);
  if ((contentType.includes("image/") || looksHtml) && !mpegTs && !mp4) {
    return new Response("Upstream served a decoy/non-media response", { status: 502 });
  }

  // Segments & progressive files: stream through with a size ceiling.
  const contentLength = Number(upstream.headers.get("content-length") ?? 0);
  if (contentLength > 512 * 1024 * 1024) {
    return new Response("Segment too large", { status: 502 });
  }
  let sent = 0;
  const guarded = new TransformStream({
    transform(chunk, controller) {
      sent += chunk.byteLength;
      if (sent > 512 * 1024 * 1024) {
        controller.error(new Error("Segment too large"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  const replayed = new ReadableStream({
    async start(controller) {
      try {
        for (const chunk of chunks) controller.enqueue(chunk);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  const outHeaders: Record<string, string> = {
    // Upstreams label everything image/jpeg — trust the sniffed bytes instead.
    "content-type": mpegTs ? "video/mp2t" : mp4 ? "video/mp4" : contentType || "video/mp2t",
    "cache-control": "private, max-age=15",
  };
  if (contentLength > 0) outHeaders["content-length"] = String(contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) outHeaders["content-range"] = contentRange;
  if (upstream.status === 206) outHeaders["accept-ranges"] = "bytes";
  return new Response(replayed.pipeThrough(guarded), {
    status: upstream.status === 206 ? 206 : 200,
    headers: outHeaders,
  });
}
