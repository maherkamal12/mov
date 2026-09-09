import { NextRequest, NextResponse } from "next/server";
import { db, isDbAvailable } from "@/db";
import { categories, movies, movieCategories } from "@/db/schema";
import { scrapeMoviesPage, SOURCE_CATEGORIES } from "@/lib/scraper";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync-all
 * Syncs multiple pages across categories. Call repeatedly to progress.
 * Body: { pagesPerCategory?: number }  (default: 5 pages per call)
 */
export async function POST(request: NextRequest) {
  if (!isDbAvailable() || !db) {
    return NextResponse.json(
      { success: false, error: "Database is not configured. Set DATABASE_URL." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const pagesPerCategory =
      (body as { pagesPerCategory?: number }).pagesPerCategory || 5;

    const progress: Record<string, { synced: number; total: number; newMovies: number }> = {};
    let totalNew = 0;

    for (const cat of SOURCE_CATEGORIES) {
      const existing = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, cat.slug))
        .limit(1);

      let lastPage = existing[0]?.lastScrapedPage || 0;
      let totalPages = existing[0]?.totalPages || 1;

      if (existing.length === 0) {
        await db.insert(categories).values({
          slug: cat.slug,
          name: cat.name,
          nameAr: cat.nameAr,
          totalPages: 1,
        });
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

          await db
            .update(categories)
            .set({
              totalPages,
              lastScrapedPage: nextPage,
              updatedAt: new Date(),
            })
            .where(eq(categories.slug, cat.slug));

          for (let j = 0; j < result.movies.length; j++) {
            const movie = result.movies[j];

            const movieExists = await db
              .select({ vid: movies.vid })
              .from(movies)
              .where(eq(movies.vid, movie.vid))
              .limit(1);

            if (movieExists.length === 0) {
              await db.insert(movies).values({
                vid: movie.vid,
                title: movie.title,
                image: movie.image,
                duration: movie.duration,
                year: movie.year,
                sourceUrl: movie.sourceUrl,
              });
              newMovies++;
            } else {
              await db
                .update(movies)
                .set({
                  title: movie.title,
                  image: movie.image,
                  duration: movie.duration,
                  year: movie.year,
                  updatedAt: new Date(),
                })
                .where(eq(movies.vid, movie.vid));
            }

            const linkExists = await db
              .select()
              .from(movieCategories)
              .where(
                and(
                  eq(movieCategories.movieVid, movie.vid),
                  eq(movieCategories.categorySlug, cat.slug)
                )
              )
              .limit(1);

            if (linkExists.length === 0) {
              await db.insert(movieCategories).values({
                movieVid: movie.vid,
                categorySlug: cat.slug,
                position: (nextPage - 1) * 40 + j,
              });
            }
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

    const movieCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(movies);
    const catCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories);
    const linkCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(movieCategories);

    return NextResponse.json({
      success: true,
      data: {
        totalMovies: movieCount[0]?.count || 0,
        totalCategories: catCount[0]?.count || 0,
        totalLinks: linkCount[0]?.count || 0,
        newThisRun: totalNew,
        progress,
      },
    });
  } catch (error) {
    console.error("Error in sync-all:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
