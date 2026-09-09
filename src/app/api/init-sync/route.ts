import { NextResponse } from "next/server";
import { isDbAvailable, pool, db } from "@/db";
import { categories, movies, movieCategories } from "@/db/schema";
import { scrapeMoviesPage, SOURCE_CATEGORIES } from "@/lib/scraper";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Create tables using raw SQL through pg pool (works with PgBouncer) */
async function createTablesRaw() {
  if (!pool) throw new Error("No database pool");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * GET /api/init-sync
 * Creates tables if needed, then syncs page 1 of every category.
 */
export async function GET() {
  if (!isDbAvailable() || !db) {
    return NextResponse.json(
      { success: false, error: "DATABASE_URL is not set." },
      { status: 503 }
    );
  }

  const steps: string[] = [];

  try {
    // Step 1: Create tables
    try {
      await createTablesRaw();
      steps.push("✅ Tables ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      steps.push(`⚠️ Table creation: ${msg}`);
    }

    // Step 2: Check if already synced
    try {
      const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(movies);
      const existing = countResult[0]?.count || 0;
      if (existing > 100) {
        return NextResponse.json({
          success: true,
          message: `Already has ${existing} movies. Visit /api/sync-all for more.`,
          steps,
          totalMovies: existing,
        });
      }
    } catch {
      steps.push("⚠️ Could not count movies, syncing anyway");
    }

    // Step 3: Sync page 1 of each category
    let totalSynced = 0;
    const syncErrors: string[] = [];

    for (const cat of SOURCE_CATEGORIES) {
      try {
        const result = await scrapeMoviesPage(cat.slug, 1);

        // Upsert category using raw SQL (avoids prepared statement issues with PgBouncer)
        if (pool) {
          const c = await pool.connect();
          try {
            await c.query(
              `INSERT INTO categories (slug, name, name_ar, total_pages) VALUES ($1, $2, $3, $4)
               ON CONFLICT (slug) DO UPDATE SET total_pages = $4, updated_at = NOW()`,
              [cat.slug, cat.name, cat.nameAr, result.totalPages]
            );

            for (let j = 0; j < result.movies.length; j++) {
              const movie = result.movies[j];
              await c.query(
                `INSERT INTO movies (vid, title, image, duration, year, source_url)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (vid) DO UPDATE SET title = $2, image = $3, duration = $4, year = $5, updated_at = NOW()`,
                [movie.vid, movie.title, movie.image, movie.duration, movie.year, movie.sourceUrl]
              );
              await c.query(
                `INSERT INTO movie_categories (movie_vid, category_slug, position)
                 VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING`,
                [movie.vid, cat.slug, j]
              );
            }
          } finally {
            c.release();
          }
        }

        totalSynced += result.movies.length;
      } catch (err) {
        syncErrors.push(`${cat.slug}: ${err instanceof Error ? err.message : "failed"}`);
        // Only log first 5 errors in detail
        if (syncErrors.length <= 5) {
          steps.push(`❌ ${cat.slug}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
    }

    steps.push(`✅ Synced ${totalSynced} movies`);
    if (syncErrors.length > 0) {
      steps.push(`⚠️ ${syncErrors.length} errors`);
    }

    // Final count
    let finalCount = 0;
    try {
      const c = await db.select({ count: sql<number>`count(*)::int` }).from(movies);
      finalCount = c[0]?.count || 0;
    } catch {
      // try raw query
      if (pool) {
        try {
          const c = await pool.connect();
          try {
            const r = await c.query(`SELECT count(*)::int as cnt FROM movies`);
            finalCount = r.rows[0]?.cnt || 0;
          } finally { c.release(); }
        } catch { /* ignore */ }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Done! ${totalSynced} movies synced. Total in DB: ${finalCount}. Visit /api/sync-all for more.`,
      steps,
      totalMovies: finalCount,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    steps.push(`❌ Error: ${msg}`);
    return NextResponse.json({ success: false, error: msg, steps }, { status: 500 });
  }
}
