import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

let pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

if (databaseUrl) {
  const isExternalDb =
    databaseUrl.includes("supabase") ||
    databaseUrl.includes("neon") ||
    databaseUrl.includes("railway") ||
    databaseUrl.includes("render") ||
    !databaseUrl.includes("127.0.0.1");

  const sslConfig = isExternalDb ? { rejectUnauthorized: false } : undefined;

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
}

export { pool, _db as db };

/** Check if the database is available. */
export function isDbAvailable(): boolean {
  return _db !== null;
}
