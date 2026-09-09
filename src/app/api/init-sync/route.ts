import { NextResponse } from "next/server";
import { isDbAvailable, getDDLPool, db } from "@/db";
import { categories, movies, movieCategories } from "@/db/schema";
import { scrapeMoviesPage, SOURCE_CATEGORIES } from "@/lib/scraper";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/init-sync
 * Creates tables if needed, then syncs page 1 of every category.
 */
export async function GET() {
  if (!isDbAvailable() || !db) {
    return NextResponse.json(
      { success: false, error: "DATABASE_URL is not set. Add it in Vercel Environment Variables." },
      { status: 503 }
    );
  }

  const steps: string[] = [];

  try {
    // Step 1: Auto-create tables using DDL pool (direct connection for Supabase)
    const ddlPool = getDDLPool();
    if (ddlPool) {
      const client = await ddlPool.connect();
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
        steps.push("✅ Tables created successfully");
      } catch (e) {
        await client.query("ROLLBACK");
        const msg = e instanceof Error ? e.message : "unknown";
        steps.push(`⚠️ Table creation issue: ${msg}`);
      } finally {
        client.release();
      }
    }

    // Step 2: Check if already has data
    try {
      const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(movies);
      const existing = countResult[0]?.count || 0;
      if (existing > 100) {
        steps.push(`✅ DB already has ${existing} movies`);
        return NextResponse.json({
          success: true,
          message: `Database already has ${existing} movies. Visit /api/sync-all to add more.`,
          steps,
          totalMovies: existing,
        });
      }
    } catch {
      steps.push("⚠️ Could not count movies, will sync anyway");
    }

    // Step 3: Sync page 1 of each category
    let totalSynced = 0;
    const syncErrors: string[] = [];

    for (const cat of SOURCE_CATEGORIES) {
      try {
        const result = await scrapeMoviesPage(cat.slug, 1);

        // Upsert category
        try {
          await db.insert(categories).values({
            slug: cat.slug, name: cat.name, nameAr: cat.nameAr, totalPages: result.totalPages,
          });
        } catch {
          try {
            await db.update(categories).set({ totalPages: result.totalPages, updatedAt: new Date() }).where(eq(categories.slug, cat.slug));
          } catch { /* ignore */ }
        }

        // Upsert each movie
        for (let j = 0; j < result.movies.length; j++) {
          const movie = result.movies[j];
          try {
            await db.insert(movies).values({
              vid: movie.vid, title: movie.title, image: movie.image,
              duration: movie.duration, year: movie.year, sourceUrl: movie.sourceUrl,
            });
          } catch {
            try {
              await db.update(movies).set({
                title: movie.title, image: movie.image, duration: movie.duration,
                year: movie.year, updatedAt: new Date(),
              }).where(eq(movies.vid, movie.vid));
            } catch { /* ignore */ }
          }
          try {
            await db.insert(movieCategories).values({
              movieVid: movie.vid, categorySlug: cat.slug, position: j,
            });
          } catch { /* link already exists */ }
        }

        totalSynced += result.movies.length;
      } catch (err) {
        syncErrors.push(`${cat.slug}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    steps.push(`✅ Synced ${totalSynced} movies`);
    if (syncErrors.length > 0) {
      steps.push(`⚠️ ${syncErrors.length} errors: ${syncErrors.slice(0, 3).join(", ")}`);
    }

    // Final count
    let finalCount = 0;
    try {
      const c = await db.select({ count: sql<number>`count(*)::int` }).from(movies);
      finalCount = c[0]?.count || 0;
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      message: `Done! ${totalSynced} movies synced. Total in DB: ${finalCount}. Visit /api/sync-all to load more.`,
      steps,
      totalMovies: finalCount,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    steps.push(`❌ Error: ${msg}`);
    return NextResponse.json({ success: false, error: msg, steps }, { status: 500 });
  }
}
