import { db, isDbAvailable, getDDLPool } from "@/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/setup-db
 * Automatically creates all required tables and indexes.
 * Works with both direct and pooler Supabase URLs.
 */
export async function GET() {
  if (!isDbAvailable() || !db) {
    return NextResponse.json(
      { success: false, error: "DATABASE_URL is not set. Add it in Vercel Environment Variables." },
      { status: 503 }
    );
  }

  const steps: string[] = [];
  const ddlPool = getDDLPool();

  try {
    // Test connection
    if (!ddlPool) throw new Error("No database pool available");
    const client = await ddlPool.connect();
    try {
      await client.query("SELECT 1");
      steps.push("✅ Database connection OK");
    } finally {
      client.release();
    }

    // Create tables using raw SQL (works with both pooler and direct)
    const client2 = await ddlPool.connect();
    try {
      await client2.query("BEGIN");

      await client2.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          slug TEXT NOT NULL,
          name TEXT NOT NULL,
          name_ar TEXT NOT NULL,
          total_pages INTEGER NOT NULL DEFAULT 1,
          last_scraped_page INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await client2.query(`CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug)`);

      await client2.query(`
        CREATE TABLE IF NOT EXISTS movies (
          id SERIAL PRIMARY KEY,
          vid TEXT NOT NULL,
          title TEXT NOT NULL,
          image TEXT,
          duration TEXT,
          year INTEGER,
          source_url TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await client2.query(`CREATE UNIQUE INDEX IF NOT EXISTS movies_vid_idx ON movies(vid)`);
      await client2.query(`CREATE INDEX IF NOT EXISTS movies_year_idx ON movies(year)`);

      await client2.query(`
        CREATE TABLE IF NOT EXISTS movie_categories (
          id SERIAL PRIMARY KEY,
          movie_vid TEXT NOT NULL,
          category_slug TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0
        )
      `);
      await client2.query(`CREATE INDEX IF NOT EXISTS mc_vid_idx ON movie_categories(movie_vid)`);
      await client2.query(`CREATE INDEX IF NOT EXISTS mc_cat_idx ON movie_categories(category_slug)`);
      await client2.query(`CREATE INDEX IF NOT EXISTS mc_cat_pos_idx ON movie_categories(category_slug, position)`);

      await client2.query(`
        CREATE TABLE IF NOT EXISTS scraping_log (
          id SERIAL PRIMARY KEY,
          category_slug TEXT NOT NULL,
          page INTEGER NOT NULL DEFAULT 1,
          movies_count INTEGER NOT NULL DEFAULT 0,
          scraped_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client2.query("COMMIT");
      steps.push("✅ All tables created successfully");
    } catch (e) {
      await client2.query("ROLLBACK");
      throw e;
    } finally {
      client2.release();
    }

    // Verify
    const client3 = await ddlPool.connect();
    try {
      const tableCheck = await client3.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      );
      const tables = tableCheck.rows.map((r) => String(r.tablename));
      steps.push(`✅ Tables found: ${tables.join(", ")}`);

      const movieCheck = await client3.query(`SELECT count(*)::int as cnt FROM movies`);
      steps.push(`✅ Movies in DB: ${movieCheck.rows[0]?.cnt || 0}`);
    } finally {
      client3.release();
    }

    return NextResponse.json({
      success: true,
      message: "Database ready! Now visit /api/init-sync to load movies.",
      steps,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    steps.push(`❌ Error: ${msg}`);

    return NextResponse.json(
      { success: false, error: msg, steps },
      { status: 500 }
    );
  }
}
