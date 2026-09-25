# KURO — Premium Anime Streaming Platform

A cinematic, ad-free anime streaming web app built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **MongoDB**, **Vidstack Player**, and a **provider abstraction** (Consumet / Anify / bundled demo catalog).

Deep-black UI • violet→crimson gradients • multi-server manual playback • resume-anywhere progress • watchlists & favorites.

---

## ✨ Features

| Area | What you get |
| --- | --- |
| **Home** | Full-bleed rotating cinematic hero (backdrop, JP title, rating, genres, watch/add actions), ranked trending carousel, lazy-loaded sections (Trending, Fresh Episodes, Popular, Most Watched, Recently Added, Action, Romance, Fantasy, Psychological, Isekai, Shounen, Seinen) |
| **Search** | Debounced navbar quick-search with keyboard navigation, plus `/search` with genre / type / status / year / sort filters and pagination |
| **Anime details** | `/anime/[id]` — backdrop header, poster, synopsis, metadata, watchlist/favorite buttons, episode browser with search, watched + filler indicators and chunked pagination |
| **Watch page** | `/watch/[animeId]/[episodeId]` — fully custom Vidstack dark UI: seek/volume/speed/quality/captions/PiP/fullscreen, keyboard shortcuts, auto-hide controls, resume playback, prev/next, autoplay-next, episode side panel |
| **Multi-server** | Manual server switcher under the player. Direct `.m3u8`/`.mp4` only — iframe/embed sources are detected and omitted. Preferred server persisted per anime in `localStorage`. **No auto-fallback**: failed servers are marked & disabled; the user chooses the next server |
| **Continue watching** | Progress stored in MongoDB (or in-memory fallback), saved every 10s + on pause/tab-close via `sendBeacon`, resume from the exact second |
| **Accounts** | NextAuth credentials auth (bcrypt hashes, JWT sessions). Watchlist, favorites, history, profile stats |
| **Quality** | Skeletons everywhere, elegant empty/error states with retry, SEO metadata + OG/Twitter cards + sitemap + robots, `prefers-reduced-motion` support, ARIA labels, mobile-first responsive layout |

## 🧱 Tech stack

- **Next.js 14** App Router · Server Components by default, Client Components only where interactive
- **TypeScript** (strict) · **Tailwind CSS** design system · **Vidstack** `@vidstack/react` + `hls.js`
- **MongoDB** (Atlas-ready) with a zero-config in-memory fallback store
- **NextAuth** (credentials + JWT) · **next/image** optimization · custom toast/modal systems

## 🚀 Quick start

```bash
# 1. install
npm install

# 2. configure (optional in demo mode — see .env.example)
cp .env.example .env.local

# 3. develop
npm run dev          # http://localhost:3000

# 4. production
npm run build
npm run start
```

Out of the box the app runs in **demo mode**: a bundled catalog (factual metadata + images via the AniList CDN) with **free public test streams** (Mux / Apple / Unified Streaming / Blender open movies), so playback, server switching, and failure handling work with zero configuration.

**Demo login:** `demo@kuro.app` / `kurodemo` (or register a real account — everything works in memory until you attach MongoDB).

## 🔐 Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | no* | MongoDB Atlas connection string. *If empty, an in-memory store is used (resets on restart).* |
| `DATABASE_NAME` | no | Database name (default `kuro`) |
| `ANIME_PROVIDER` | no | `demo` (default) · `anivexa` · `consumet` · `anify` |
| `ANIME_API_BASE_URL` | for consumet/anify | Your Consumet instance (e.g. `http://localhost:4100`) or `https://api.anify.it` |
| `ANIME_API_KEY` | no | API key for Anify deployments that require one |
| `CONSUMET_STREAMING_PROVIDER` | no | Consumet streaming provider to extract from (default `gogoanime`) |
| `NEXTAUTH_SECRET` | production | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | production | e.g. `https://your-app.vercel.app` |
| `NEXT_PUBLIC_SITE_URL` | no | Used for canonical URLs, OG tags, sitemap |

Never commit `.env.local`. Secrets are only ever read server-side (`process.env` in Server Components / route handlers).

## 🔌 Provider abstraction

The UI never talks to Consumet or Anify directly — everything goes through one interface in `lib/anime/provider.ts`:

```ts
interface AnimeProvider {
  searchAnime(...); advancedSearch(...);
  getTrendingAnime(...); getPopularAnime(...);
  getRecentlyUpdated(...); getRecentlyAdded(...); getMostWatched(...);
  getByGenre(...); getGenres();
  getAnimeDetails(...); getEpisodes(...);
  getEpisodeServers(...);          // normalized server list
  getStreamingSources(...);        // direct .m3u8/.mp4 only
}
```

Adapters live in `lib/anime/providers/`:

```
demo/      bundled offline catalog (default — no keys needed)
anilist.ts   direct AniList GraphQL client (metadata, no key needed)
anivexa.ts   AniList metadata + your Anivexa-API instance for streams
             (14 providers, SUB/DUB server pools, direct .m3u8 only)
consumet.ts  Consumet API (AniList metadata + gogoanime/zoro extraction)
anify.ts     Anify API (project discontinued — kept for reference)
index.ts     registry — switching providers is one env var
```

### Anivexa setup (real streams, sub & dub)

1. Host [Anivexa-API](https://github.com/walterwhite-69/Anivexa-API) yourself —
   **Render/Railway/VPS recommended** (the author warns Vercel's shared IPs are
   blocked by most providers). It runs plain Node: `npm install && node server.js`.
2. Point KURO at it:

```env
ANIME_PROVIDER=anivexa
ANIME_API_BASE_URL=https://your-anivexa.onrender.com
```

KURO then merges AniList discovery (trending, search, details) with Anivexa's
per-provider episode pools: every provider × audio track becomes a server in
the switcher (grouped under SUB / DUB tabs), and only direct `.m3u8`/`.mp4`
streams are ever handed to the player — `type: "embed"` responses are dropped.

**Stream proxy (`/api/stream`)** — provider CDNs lock CORS to their own embed
players and serve decoy responses to foreign origins, so direct browser
playback is impossible. KURO therefore routes all media through its own
origin: the proxy fetches upstream server-side with the provider's required
`Referer`, sniffs the payload (CDNs mislabel playlists as `image/jpeg`),
rewrites every HLS URI to stay inside the proxy, passes byte `Range` headers
through for seeking, and 502s obvious decoys. The player only ever talks to
same-origin URLs; no iframes, no third-party player pages.

The Consumet adapter **aggressively filters for direct media URLs** (`isDirectMedia`): `.m3u8` / `.mp4` responses are kept; iframe/embed pages are flagged `embedOnly` and removed from the server switcher, keeping the app ad-free.

### Using a self-hosted Consumet instance

```bash
docker run -p 4100:4100 riimuru/consumet-api
```

```env
ANIME_PROVIDER=consumet
ANIME_API_BASE_URL=http://localhost:4100
CONSUMET_STREAMING_PROVIDER=gogoanime
```

## 🗄️ MongoDB Atlas setup

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas)
2. Add a database user and allow your network / `0.0.0.0/0` for Vercel
3. Copy the connection string into `MONGODB_URI` (`mongodb+srv://user:pass@cluster…/kuro`)
4. Collections (`users`, `progress`, `watchlist`, `favorites`, `reports`) and indexes are created automatically on first write

## ▲ Deploy to Vercel

1. Push this repo to GitHub
2. [vercel.com/new](https://vercel.com/new) → import the repo (framework auto-detected: Next.js)
3. Add environment variables: `MONGODB_URI`, `DATABASE_NAME`, `ANIME_PROVIDER`, `ANIME_API_BASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (= your Vercel URL), `NEXT_PUBLIC_SITE_URL`
4. Deploy — `next build` runs automatically on every push

Local build check before pushing:

```bash
npm run typecheck && npm run lint && npm run build
```

## 🎮 Player reference

**Keyboard:** `Space`/`K` play · `←`/`→` ±5s · `J`/`L` ±10s · `↑`/`↓` volume · `M` mute · `F` fullscreen · `P` PiP · `C` captions · `S` skip intro · `0–9` seek to %

**Skip suite:** a **Skip Intro** pill appears during the opening window and a
**Next Episode** pill during the ending window (when the provider reports
`intro`/`outro` timestamps — falling back gracefully when absent). Auto-skip
for both, plus autoplay-next, are toggleable in the player settings menu and
persisted per device. Server switching preserves position, speed, volume and
caption language; failed servers are marked & disabled for manual recovery
(never auto-switched).

**Server switching:** position, playback rate, volume, mute, caption language and fullscreen are preserved. The player seeks back after the swap and resumes playback automatically. A failed server shows the manual-recovery overlay + toast and is disabled for the rest of the session — **the app never auto-switches or retries a failed source**.

## 🗂️ Project structure

```
app/                  routes (App Router) + API route handlers
  api/anime/…         search · sections · servers · sources
  api/…               progress · watchlist · favorites · report · auth
components/
  anime/              hero, cards, carousel, grid, genres, watchlist button
  player/             player-shell, custom controls, server switcher
  episodes/           episode browser + watch-page panel
  library/            watchlist, history, continue watching, profile
  search/             quick-search + full search client
  ui/                 buttons, inputs, skeletons, toast, modal
  layout/             navbar, mobile nav, footer
lib/
  anime/providers/    demo · consumet · anify + registry
  anime/              cache, sections, errors
  db/                 mongo client + store (mongo | memory)
  auth/               NextAuth options, password hashing
  player/             source-manager, player types/prefs
hooks/ types/ utils/  shared primitives
```

## ⚖️ Legal note

This project is a **player/UI framework and API client**. It ships with a demo catalog that references only free public test streams and factual metadata. If you configure a third-party provider (Consumet/Anify), you are responsible for ensuring your use complies with the laws and terms of service in your jurisdiction. All anime titles, artwork and trademarks belong to their respective owners. Intended for personal/educational use.
