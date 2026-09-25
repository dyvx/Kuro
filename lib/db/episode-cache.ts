import { hasMongo, getDb } from "./mongo";

/* ────────────────────────────────────────────────────────────────
   PROVIDER CACHE (L2, MongoDB-backed)
   Serverless instances are ephemeral, so the in-memory cache alone
   can't keep scraped provider data warm. This persists it in Mongo
   (if configured) with automatic expiry via a TTL index — repeat
   visits become instant even across instances/deploys.
   ──────────────────────────────────────────────────────────────── */

const COLLECTION = "provider_cache";
let indexed = false;

async function ensureIndexes() {
  if (indexed) return;
  const db = await getDb();
  await db
    .collection(COLLECTION)
    .createIndex({ key: 1 }, { unique: true })
    .catch(() => {});
  await db
    .collection(COLLECTION)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    .catch(() => {});
  indexed = true;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!hasMongo()) return null;
  try {
    await ensureIndexes();
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({
      key,
      expiresAt: { $gt: new Date() },
    });
    return doc ? (doc.data as T) : null;
  } catch {
    return null; // cache must never break the request path
  }
}

export async function cacheSet(
  key: string,
  data: unknown,
  ttlSeconds: number
): Promise<void> {
  if (!hasMongo()) return;
  try {
    await ensureIndexes();
    const db = await getDb();
    await db.collection(COLLECTION).replaceOne(
      { key },
      { key, data, expiresAt: new Date(Date.now() + ttlSeconds * 1000) },
      { upsert: true }
    );
  } catch {
    /* non-fatal */
  }
}
