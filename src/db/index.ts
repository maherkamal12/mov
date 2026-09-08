import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

// Database is optional — the app works without it (falls back to live scraping)
// Only create the pool/connection when DATABASE_URL is available.

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

let pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

if (databaseUrl) {
  pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }

  _db = drizzle(pool);
}

export { pool, _db as db };

/** Check if the database is available. */
export function isDbAvailable(): boolean {
  return _db !== null;
}
