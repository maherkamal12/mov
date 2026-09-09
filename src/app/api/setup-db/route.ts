import { db, isDbAvailable, pool } from "@/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/setup-db
 * Automatically creates all required tables and indexes in the database.
 * Call this ONCE after setting up DATABASE_URL.
 */
export async function GET() {
  if (!isDbAvailable() || !db || !pool) {
    return NextResponse.json(
      { success: false, error: "DATABASE_URL is not set or invalid." },
      { status: 503 }
    );
  }

  const createSQL = `
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      total_pages INTEGER NOT NULL DEFAULT 1,
      last_scraped_page INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug);

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
    );
    CREATE UNIQUE INDEX IF NOT EXISTS movies_vid_idx ON movies(vid);
    CREATE INDEX IF NOT EXISTS movies_year_idx ON movies(year);

    CREATE TABLE IF NOT EXISTS movie_categories (
      id SERIAL PRIMARY KEY,
      movie_vid TEXT NOT NULL,
      category_slug TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS mc_vid_idx ON movie_categories(movie_vid);
    CREATE INDEX IF NOT EXISTS mc_cat_idx ON movie_categories(category_slug);
    CREATE INDEX IF NOT EXISTS mc_cat_pos_idx ON movie_categories(category_slug, position);

    CREATE TABLE IF NOT EXISTS scraping_log (
      id SERIAL PRIMARY KEY,
      category_slug TEXT NOT NULL,
      page INTEGER NOT NULL DEFAULT 1,
      movies_count INTEGER NOT NULL DEFAULT 0,
      scraped_at TIMESTAMP DEFAULT NOW()
    );
  `;

  const steps: string[] = [];

  try {
    // Test connection first
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      steps.push("✅ Database connection OK");
    } finally {
      client.release();
    }

    // Create tables
    await db.execute(createSQL);
    steps.push("✅ Tables created");

    // Verify tables exist
    const checkResult = await db.execute(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tables = checkResult.rows.map((r: Record<string, unknown>) => String(r.tablename));
    steps.push(`✅ Found tables: ${tables.join(", ")}`);

    const movieCount = await db.execute(`SELECT count(*)::int as cnt FROM movies`);
    const count = movieCount.rows[0]?.cnt || 0;
    steps.push(`✅ Movies in DB: ${count}`);

    return NextResponse.json({
      success: true,
      message: "Database setup complete! Now visit /api/init-sync to load movies.",
      steps,
      tableCount: tables.length,
      movieCount: count,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    steps.push(`❌ Error: ${msg}`);

    return NextResponse.json(
      {
        success: false,
        error: msg,
        steps,
      },
      { status: 500 }
    );
  }
}
