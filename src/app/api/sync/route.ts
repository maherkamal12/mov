import { NextRequest, NextResponse } from "next/server";
import { isDbAvailable } from "@/db";
import { SOURCE_CATEGORIES } from "@/lib/scraper";

export const dynamic = "force-dynamic";

/** GET /api/sync - Get sync status */
export async function GET() {
  if (!isDbAvailable()) {
    return NextResponse.json({
      success: true,
      data: { totalMovies: 0, totalCategories: 0, dbAvailable: false },
    });
  }

  try {
    const { pool } = await import("@/db");
    if (!pool) throw new Error("No pool");

    const client = await pool.connect();
    try {
      const r1 = await client.query(`SELECT count(*)::int as c FROM movies`);
      const r2 = await client.query(`SELECT count(*)::int as c FROM categories`);
      const r3 = await client.query(`SELECT count(*)::int as c FROM movie_categories`);
      return NextResponse.json({
        success: true,
        data: {
          totalMovies: r1.rows[0]?.c || 0,
          totalCategories: r2.rows[0]?.c || 0,
          totalLinks: r3.rows[0]?.c || 0,
          dbAvailable: true,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** POST /api/sync - Trigger single page sync */
export async function POST(request: NextRequest) {
  if (!isDbAvailable()) {
    return NextResponse.json(
      { success: false, error: "Database not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { category, page } = body as { category?: string; page?: number };
    if (!category) {
      return NextResponse.json({ success: false, error: "category required" }, { status: 400 });
    }

    const { pool } = await import("@/db");
    if (!pool) throw new Error("No pool");

    const p = page || 1;
    const { scrapeMoviesPage } = await import("@/lib/scraper");
    const result = await scrapeMoviesPage(category, p);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let j = 0; j < result.movies.length; j++) {
        const movie = result.movies[j];
        await client.query(
          `INSERT INTO movies (vid, title, image, duration, year, source_url) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (vid) DO UPDATE SET title=$2, image=$3, duration=$4, year=$5, updated_at=NOW()`,
          [movie.vid, movie.title, movie.image, movie.duration, movie.year, movie.sourceUrl]
        );
        await client.query(
          `INSERT INTO movie_categories (movie_vid, category_slug, position) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [movie.vid, category, (p - 1) * 40 + j]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, data: { count: result.movies.length, totalPages: result.totalPages } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
