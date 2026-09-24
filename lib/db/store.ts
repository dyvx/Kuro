import { hasMongo, getDb, ensureIndexes } from "./mongo";

/* ────────────────────────────────────────────────────────────────
   DATA STORE
   One interface, two implementations:
   • MongoStore  — production (set MONGODB_URI)
   • MemoryStore — zero-config demo fallback (data resets on restart)

   Everything user-private lives here and is only ever exposed through
   session-scoped API routes.
   ──────────────────────────────────────────────────────────────── */

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

export interface StoredProgress {
  userId: string;
  animeId: string;
  animeTitle: string;
  animeImage: string | null;
  episodeId: string;
  episodeNumber: number;
  episodeTitle?: string | null;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
}

export interface StoredLibraryItem {
  userId: string;
  animeId: string;
  animeTitle: string;
  animeImage: string | null;
  animeType?: string;
  animeYear?: number | null;
  animeRating?: number | null;
  addedAt: string;
}

export interface StoredReport {
  id: string;
  userId: string | null;
  animeId: string;
  episodeId: string;
  serverId: string;
  reason?: string;
  createdAt: string;
}

export interface ProgressInput {
  animeId: string;
  animeTitle: string;
  animeImage: string | null;
  episodeId: string;
  episodeNumber: number;
  episodeTitle?: string | null;
  position: number;
  duration: number;
}

const COMPLETION_THRESHOLD = 0.92;

export interface DataStore {
  readonly kind: "mongo" | "memory";
  getUserByEmail(email: string): Promise<StoredUser | null>;
  getUserById(id: string): Promise<StoredUser | null>;
  createUser(user: StoredUser): Promise<void>;
  upsertProgress(userId: string, input: ProgressInput): Promise<StoredProgress>;
  getProgress(userId: string, animeId: string): Promise<StoredProgress | null>;
  listProgress(userId: string, opts?: { completed?: boolean }): Promise<StoredProgress[]>;
  deleteProgress(userId: string, animeId: string): Promise<void>;
  listWatchlist(userId: string): Promise<StoredLibraryItem[]>;
  addWatchlist(userId: string, item: Omit<StoredLibraryItem, "userId" | "addedAt">): Promise<void>;
  removeWatchlist(userId: string, animeId: string): Promise<void>;
  inWatchlist(userId: string, animeId: string): Promise<boolean>;
  listFavorites(userId: string): Promise<StoredLibraryItem[]>;
  addFavorite(userId: string, item: Omit<StoredLibraryItem, "userId" | "addedAt">): Promise<void>;
  removeFavorite(userId: string, animeId: string): Promise<void>;
  addReport(report: StoredReport): Promise<void>;
  ping(): Promise<boolean>;
}

/* ── MongoDB implementation ─────────────────────────────────── */

function rowToLibrary(userId: string, r: Record<string, unknown>): StoredLibraryItem {
  return {
    userId,
    animeId: String(r.animeId),
    animeTitle: String(r.animeTitle ?? ""),
    animeImage: (r.animeImage as string) ?? null,
    animeType: r.animeType as string | undefined,
    animeYear: (r.animeYear as number) ?? null,
    animeRating: (r.animeRating as number) ?? null,
    addedAt: String(r.addedAt ?? new Date().toISOString()),
  };
}

const mongoStore: DataStore = {
  kind: "mongo",
  async getUserByEmail(email) {
    const db = await getDb();
    const r = await db.collection("users").findOne({ email: email.toLowerCase() });
    return r ? ({ ...(r as unknown as StoredUser), id: String(r._id ?? r.id) } as StoredUser) : null;
  },
  async getUserById(id) {
    const db = await getDb();
    const r = await db.collection("users").findOne({ id });
    return (r as unknown as StoredUser) ?? null;
  },
  async createUser(user) {
    await ensureIndexes().catch(() => {});
    const db = await getDb();
    await db.collection("users").insertOne({ ...user, email: user.email.toLowerCase() } as unknown as Record<string, unknown>);
  },
  async upsertProgress(userId, input) {
    const db = await getDb();
    const ratio = input.duration > 0 ? input.position / input.duration : 0;
    const doc = {
      userId,
      ...input,
      completed: ratio >= COMPLETION_THRESHOLD,
      updatedAt: new Date().toISOString(),
    };
    await db
      .collection("progress")
      .updateOne({ userId, animeId: input.animeId }, { $set: doc }, { upsert: true });
    return doc as StoredProgress;
  },
  async getProgress(userId, animeId) {
    const db = await getDb();
    const r = await db.collection("progress").findOne({ userId, animeId });
    return (r as unknown as StoredProgress) ?? null;
  },
  async listProgress(userId, opts) {
    const db = await getDb();
    const filter: Record<string, unknown> = { userId };
    if (opts?.completed !== undefined) filter.completed = opts.completed;
    const rows = await db
      .collection("progress")
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();
    return rows as unknown as StoredProgress[];
  },
  async deleteProgress(userId, animeId) {
    const db = await getDb();
    await db.collection("progress").deleteOne({ userId, animeId });
  },
  async listWatchlist(userId) {
    const db = await getDb();
    const rows = await db.collection("watchlist").find({ userId }).sort({ addedAt: -1 }).limit(500).toArray();
    return rows.map((r) => rowToLibrary(userId, r as Record<string, unknown>));
  },
  async addWatchlist(userId, item) {
    const db = await getDb();
    await db
      .collection("watchlist")
      .updateOne({ userId, animeId: item.animeId }, { $set: { userId, ...item, addedAt: new Date().toISOString() } }, { upsert: true });
  },
  async removeWatchlist(userId, animeId) {
    const db = await getDb();
    await db.collection("watchlist").deleteOne({ userId, animeId });
  },
  async inWatchlist(userId, animeId) {
    const db = await getDb();
    return (await db.collection("watchlist").findOne({ userId, animeId })) !== null;
  },
  async listFavorites(userId) {
    const db = await getDb();
    const rows = await db.collection("favorites").find({ userId }).sort({ addedAt: -1 }).limit(500).toArray();
    return rows.map((r) => rowToLibrary(userId, r as Record<string, unknown>));
  },
  async addFavorite(userId, item) {
    const db = await getDb();
    await db
      .collection("favorites")
      .updateOne({ userId, animeId: item.animeId }, { $set: { userId, ...item, addedAt: new Date().toISOString() } }, { upsert: true });
  },
  async removeFavorite(userId, animeId) {
    const db = await getDb();
    await db.collection("favorites").deleteOne({ userId, animeId });
  },
  async addReport(report) {
    const db = await getDb();
    await db.collection("reports").insertOne({ ...report } as unknown as Record<string, unknown>);
  },
  async ping() {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  },
};

/* ── In-memory implementation (demo fallback) ───────────────── */

interface MemoryDB {
  users: Map<string, StoredUser>;
  progress: Map<string, StoredProgress>;
  watchlist: Map<string, StoredLibraryItem>;
  favorites: Map<string, StoredLibraryItem>;
  reports: StoredReport[];
}

const g = globalThis as unknown as { __kuroMemory?: MemoryDB };
const mem: MemoryDB =
  g.__kuroMemory ?? { users: new Map(), progress: new Map(), watchlist: new Map(), favorites: new Map(), reports: [] };
g.__kuroMemory = mem;

const pkey = (userId: string, animeId: string) => `${userId}::${animeId}`;

const memoryStore: DataStore = {
  kind: "memory",
  async getUserByEmail(email) {
    return mem.users.get(email.toLowerCase()) ?? null;
  },
  async getUserById(id) {
    for (const u of Array.from(mem.users.values())) if (u.id === id) return u;
    return null;
  },
  async createUser(user) {
    mem.users.set(user.email.toLowerCase(), { ...user, email: user.email.toLowerCase() });
  },
  async upsertProgress(userId, input) {
    const ratio = input.duration > 0 ? input.position / input.duration : 0;
    const doc: StoredProgress = {
      userId,
      ...input,
      completed: ratio >= COMPLETION_THRESHOLD,
      updatedAt: new Date().toISOString(),
    };
    mem.progress.set(pkey(userId, input.animeId), doc);
    return doc;
  },
  async getProgress(userId, animeId) {
    return mem.progress.get(pkey(userId, animeId)) ?? null;
  },
  async listProgress(userId, opts) {
    return Array.from(mem.progress.values())
      .filter((p) => p.userId === userId && (opts?.completed === undefined || p.completed === opts.completed))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async deleteProgress(userId, animeId) {
    mem.progress.delete(pkey(userId, animeId));
  },
  async listWatchlist(userId) {
    return Array.from(mem.watchlist.values())
      .filter((i) => i.userId === userId)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  },
  async addWatchlist(userId, item) {
    mem.watchlist.set(pkey(userId, item.animeId), { userId, ...item, addedAt: new Date().toISOString() });
  },
  async removeWatchlist(userId, animeId) {
    mem.watchlist.delete(pkey(userId, animeId));
  },
  async inWatchlist(userId, animeId) {
    return mem.watchlist.has(pkey(userId, animeId));
  },
  async listFavorites(userId) {
    return Array.from(mem.favorites.values())
      .filter((i) => i.userId === userId)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  },
  async addFavorite(userId, item) {
    mem.favorites.set(pkey(userId, item.animeId), { userId, ...item, addedAt: new Date().toISOString() });
  },
  async removeFavorite(userId, animeId) {
    mem.favorites.delete(pkey(userId, animeId));
  },
  async addReport(report) {
    mem.reports.push(report);
  },
  async ping() {
    return true;
  },
};

export function getStore(): DataStore {
  return hasMongo() ? mongoStore : memoryStore;
}

/** Demo convenience account for the in-memory store. */
export async function ensureDemoUser(): Promise<StoredUser> {
  const store = getStore();
  const existing = await store.getUserByEmail("demo@kuro.app");
  if (existing) return existing;
  const { hashPassword } = await import("@/lib/auth/password");
  const user: StoredUser = {
    id: "demo-user",
    email: "demo@kuro.app",
    name: "Demo Viewer",
    passwordHash: await hashPassword("kurodemo"),
    createdAt: new Date().toISOString(),
  };
  await store.createUser(user);
  return user;
}
