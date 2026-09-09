import { NextResponse } from "next/server";
import { isDbAvailable } from "@/db";
import { syncCategoryPage, getDBStats } from "@/lib/syncService";
import { SOURCE_CATEGORIES } from "@/lib/scraper";

export const dynamic = "force-dynamic";

/**
 * GET /api/init-sync
 * Syncs the first page of EVERY category to populate the homepage quickly.
 */
export async function GET() {
  if (!isDbAvailable()) {
    return NextResponse.json({
      success: false,
      error: "Database is not configured. Set DATABASE_URL.",
      data: { totalMovies: 0, totalCategories: 0, totalLinks: 0 },
    });
  }

  try {
    // Auto-create tables if they don't exist
    const { pool } = await import("@/db");
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query(`CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, name_ar TEXT NOT NULL,
          total_pages INTEGER NOT NULL DEFAULT 1, last_scraped_page INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT NOW()
        )`);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug)`);
        await client.query(`CREATE TABLE IF NOT EXISTS movies (
          id SERIAL PRIMARY KEY, vid TEXT NOT NULL, title TEXT NOT NULL, image TEXT, duration TEXT,
          year INTEGER, source_url TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
        )`);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS movies_vid_idx ON movies(vid)`);
        await client.query(`CREATE INDEX IF NOT EXISTS movies_year_idx ON movies(year)`);
        await client.query(`CREATE TABLE IF NOT EXISTS movie_categories (
          id SERIAL PRIMARY KEY, movie_vid TEXT NOT NULL, category_slug TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
        )`);
        await client.query(`CREATE INDEX IF NOT EXISTS mc_vid_idx ON movie_categories(movie_vid)`);
        await client.query(`CREATE INDEX IF NOT EXISTS mc_cat_idx ON movie_categories(category_slug)`);
        await client.query(`CREATE INDEX IF NOT EXISTS mc_cat_pos_idx ON movie_categories(category_slug, position)`);
        await client.query(`CREATE TABLE IF NOT EXISTS scraping_log (
          id SERIAL PRIMARY KEY, category_slug TEXT NOT NULL, page INTEGER NOT NULL DEFAULT 1,
          movies_count INTEGER NOT NULL DEFAULT 0, scraped_at TIMESTAMP DEFAULT NOW()
        )`);
      } finally {
        client.release();
      }
    }

    const stats = await getDBStats();

    // If we already have movies, skip
    if (stats.totalMovies > 0) {
      return NextResponse.json({
        success: true,
        message: "Database already populated",
        data: stats,
      });
    }

    // Sync page 1 of each category
    const results: Record<string, { count: number; totalPages: number }> = {};

    for (const cat of SOURCE_CATEGORIES) {
      try {
        const result = await syncCategoryPage(cat.slug, 1);
        results[cat.slug] = result;
      } catch (err) {
        console.error(`Error syncing ${cat.slug}:`, err);
        results[cat.slug] = { count: 0, totalPages: 0 };
      }
    }

    const newStats = await getDBStats();

    return NextResponse.json({
      success: true,
      message: "Initial sync complete",
      data: { results, stats: newStats },
    });
  } catch (error) {
    console.error("Error in init-sync:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
