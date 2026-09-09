import { NextRequest, NextResponse } from "next/server";
import { isDbAvailable, pool } from "@/db";
import { scrapeMoviesPage, SOURCE_CATEGORIES } from "@/lib/scraper";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync-all
 * Syncs more pages using raw SQL (works with Supabase PgBouncer).
 */
export async function POST(request: NextRequest) {
  if (!isDbAvailable() || !pool) {
    return NextResponse.json(
      { success: false, error: "Database is not configured. Set DATABASE_URL." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const pagesPerCategory = (body as { pagesPerCategory?: number }).pagesPerCategory || 5;

    const progress: Record<string, { synced: number; total: number; newMovies: number }> = {};
    let totalNew = 0;

    for (const cat of SOURCE_CATEGORIES) {
      // Get category state
      const c1 = await pool.connect();
      let lastPage = 0;
      let totalPages = 1;
      try {
        const res = await c1.query(
          `SELECT total_pages, last_scraped_page FROM categories WHERE slug = $1`,
          [cat.slug]
        );
        if (res.rows.length > 0) {
          totalPages = res.rows[0].total_pages || 1;
          lastPage = res.rows[0].last_scraped_page || 0;
        } else {
          await c1.query(
            `INSERT INTO categories (slug, name, name_ar, total_pages) VALUES ($1, $2, $3, 1) ON CONFLICT (slug) DO NOTHING`,
            [cat.slug, cat.name, cat.nameAr]
          );
        }
      } finally {
        c1.release();
      }

      let synced = 0;
      let newMovies = 0;

      for (let i = 0; i < pagesPerCategory; i++) {
        const nextPage = lastPage + 1;
        if (totalPages > 1 && nextPage > totalPages) break;

        try {
          const result = await scrapeMoviesPage(cat.slug, nextPage);

          if (result.totalPages > totalPages) {
            totalPages = result.totalPages;
          }

          // Update category and insert movies in one connection
          const c2 = await pool.connect();
          try {
            await c2.query("BEGIN");

            await c2.query(
              `UPDATE categories SET total_pages = $1, last_scraped_page = $2, updated_at = NOW() WHERE slug = $3`,
              [totalPages, nextPage, cat.slug]
            );

            for (let j = 0; j < result.movies.length; j++) {
              const movie = result.movies[j];

              const exists = await c2.query(`SELECT vid FROM movies WHERE vid = $1`, [movie.vid]);
              if (exists.rows.length === 0) {
                await c2.query(
                  `INSERT INTO movies (vid, title, image, duration, year, source_url) VALUES ($1, $2, $3, $4, $5, $6)`,
                  [movie.vid, movie.title, movie.image, movie.duration, movie.year, movie.sourceUrl]
                );
                newMovies++;
              } else {
                await c2.query(
                  `UPDATE movies SET title = $2, image = $3, duration = $4, year = $5, updated_at = NOW() WHERE vid = $1`,
                  [movie.vid, movie.title, movie.image, movie.duration, movie.year]
                );
              }

              await c2.query(
                `INSERT INTO movie_categories (movie_vid, category_slug, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [movie.vid, cat.slug, (nextPage - 1) * 40 + j]
              );
            }

            await c2.query("COMMIT");
          } catch (e) {
            await c2.query("ROLLBACK");
            throw e;
          } finally {
            c2.release();
          }

          lastPage = nextPage;
          synced++;
        } catch {
          break;
        }
      }

      progress[cat.slug] = { synced, total: totalPages, newMovies };
      totalNew += newMovies;
    }

    // Get stats
    const c3 = await pool.connect();
    let movieCount = 0;
    let linkCount = 0;
    try {
      const r1 = await c3.query(`SELECT count(*)::int as c FROM movies`);
      movieCount = r1.rows[0]?.c || 0;
      const r2 = await c3.query(`SELECT count(*)::int as c FROM movie_categories`);
      linkCount = r2.rows[0]?.c || 0;
    } finally {
      c3.release();
    }

    return NextResponse.json({
      success: true,
      data: {
        totalMovies: movieCount,
        totalLinks: linkCount,
        newThisRun: totalNew,
        progress,
      },
    });
  } catch (error) {
    console.error("Error in sync-all:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
