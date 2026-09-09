import { NextRequest, NextResponse } from "next/server";
import { scrapeMoviesPage } from "@/lib/scraper";
import { isDbAvailable, pool } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "arabic-movies";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = 40;

    // Try DB first
    if (isDbAvailable() && pool) {
      try {
        const client = await pool.connect();
        try {
          // Get total count
          const countRes = await client.query(
            `SELECT count(*)::int as c FROM movie_categories WHERE category_slug = $1`,
            [category]
          );
          const total = countRes.rows[0]?.c || 0;

          if (total > 0) {
            const totalPages = Math.max(1, Math.ceil(total / perPage));
            const offset = (page - 1) * perPage;

            const moviesRes = await client.query(
              `SELECT m.vid, m.title, m.image, m.duration, m.year, m.source_url
               FROM movie_categories mc
               JOIN movies m ON mc.movie_vid = m.vid
               WHERE mc.category_slug = $1
               ORDER BY m.year DESC NULLS LAST, mc.position ASC
               LIMIT $2 OFFSET $3`,
              [category, perPage, offset]
            );

            const movies = moviesRes.rows.map((r: Record<string, unknown>) => ({
              vid: String(r.vid),
              title: String(r.title),
              image: r.image ? String(r.image) : "",
              duration: r.duration ? String(r.duration) : "",
              sourceUrl: r.source_url ? String(r.source_url) : "",
              year: r.year as number | null,
            }));

            return NextResponse.json({
              success: true,
              data: { movies, totalPages, currentPage: page, source: "database" },
            });
          }
        } finally {
          client.release();
        }
      } catch {
        // DB failed, fall through to live
      }
    }

    // Fallback: live scrape
    const result = await scrapeMoviesPage(category, page);
    return NextResponse.json({
      success: true,
      data: { ...result, source: "live" },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
