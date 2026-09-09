import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

// Database is optional — the app works without it (falls back to live scraping)
const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDirectPool?: Pool;
};

let pool: Pool | null = null;
let directPool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

if (databaseUrl) {
  const isExternalDb =
    databaseUrl.includes("supabase") ||
    databaseUrl.includes("neon") ||
    databaseUrl.includes("railway") ||
    databaseUrl.includes("render") ||
    !databaseUrl.includes("127.0.0.1");

  const sslConfig = isExternalDb ? { rejectUnauthorized: false } : undefined;

  // Main pool (for queries)
  pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
      ssl: sslConfig,
      max: 10,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }

  _db = drizzle(pool);

  // If using Supabase pooler URL (port 6543), also create a direct connection
  // for DDL operations (CREATE TABLE etc.) because PgBouncer blocks them.
  if (databaseUrl.includes("pooler.supabase.com") || databaseUrl.includes(":6543")) {
    // Convert pooler URL to direct URL:
    // Pooler: postgresql://postgres.PROJECT_ID:PASS@aws-0-region.pooler.supabase.com:6543/postgres
    // Direct: postgresql://postgres:PASS@db.PROJECT_ID.supabase.co:5432/postgres
    try {
      const poolerMatch = databaseUrl.match(
        /postgresql:\/\/postgres\.([^.]+):([^@]+)@[^/]+\/postgres/
      );
      if (poolerMatch) {
        const projectId = poolerMatch[1];
        const password = poolerMatch[2];
        const directUrl = `postgresql://postgres:${password}@db.${projectId}.supabase.co:5432/postgres`;
        directPool =
          globalForDb.__arenaNextJsDirectPool ??
          new Pool({
            connectionString: directUrl,
            ssl: { rejectUnauthorized: false },
            max: 5,
          });
        if (process.env.NODE_ENV !== "production") {
          globalForDb.__arenaNextJsDirectPool = directPool;
        }
      }
    } catch {
      // Failed to parse pooler URL, direct pool not available
    }
  }
}

export { pool, directPool, _db as db };

/** Check if the database is available. */
export function isDbAvailable(): boolean {
  return _db !== null;
}

/**
 * Get the best pool for DDL operations (CREATE TABLE, etc).
 * For Supabase pooler connections, returns the direct pool.
 * Otherwise returns the regular pool.
 */
export function getDDLPool(): Pool | null {
  return directPool || pool;
}
