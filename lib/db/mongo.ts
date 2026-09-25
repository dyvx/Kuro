import { MongoClient } from "mongodb";

/* MongoDB connection singleton (cached on globalThis to survive HMR). */

const uri = process.env.MONGODB_URI ?? "";

const globalClient = globalThis as unknown as {
  __kuroMongo?: Promise<MongoClient>;
};

export function hasMongo(): boolean {
  return uri.trim().length > 0;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!hasMongo()) {
    throw new Error("MONGODB_URI is not configured");
  }
  if (!globalClient.__kuroMongo) {
    globalClient.__kuroMongo = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    }).connect();
  }
  return globalClient.__kuroMongo;
}

export async function getDb() {
  const client = await getMongoClient();
  return client.db(process.env.DATABASE_NAME ?? "kuro");
}

export async function ensureIndexes() {
  const db = await getDb();
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("progress").createIndex({ userId: 1, animeId: 1 }, { unique: true }),
    db.collection("progress").createIndex({ userId: 1, updatedAt: -1 }),
    db.collection("watchlist").createIndex({ userId: 1, animeId: 1 }, { unique: true }),
    db.collection("favorites").createIndex({ userId: 1, animeId: 1 }, { unique: true }),
    db.collection("reports").createIndex({ createdAt: -1 }),
    db.collection("user_profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("user_profiles").createIndex({ username: 1 }, { unique: true, sparse: true }),
    db.collection("user_activity").createIndex({ userId: 1, day: 1 }, { unique: true }),
    db.collection("user_achievements").createIndex({ userId: 1 }, { unique: true }),
  ]);
}
