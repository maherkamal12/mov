import { db } from "@/db";
import { movies, categories, movieCategories, scrapingLog } from "@/db/schema";
import { scrapeMoviesPage, SOURCE_CATEGORIES, type ScrapedMovie } from "@/lib/scraper";
import { eq, and, sql } from "drizzle-orm";

/** Upsert a single category into the DB. */
async function upsertCategory(slug: string, name: string, nameAr: string, totalPages: number) {
  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(categories)
      .set({ name, nameAr, totalPages, updatedAt: new Date() })
      .where(eq(categories.slug, slug));
  } else {
    await db.insert(categories).values({ slug, name, nameAr, totalPages });
  }
}

/** Upsert a movie and its category link. */
async function upsertMovie(movie: ScrapedMovie, categorySlug: string, position: number) {
  // Insert movie if not exists
  const existing = await db
    .select({ vid: movies.vid })
    .from(movies)
    .where(eq(movies.vid, movie.vid))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(movies).values({
      vid: movie.vid,
      title: movie.title,
      image: movie.image,
      duration: movie.duration,
      year: movie.year,
      sourceUrl: movie.sourceUrl,
    });
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

  // Insert category link if not exists
  const linkExists = await db
    .select()
    .from(movieCategories)
    .where(
      and(
        eq(movieCategories.movieVid, movie.vid),
        eq(movieCategories.categorySlug, categorySlug)
      )
    )
    .limit(1);

  if (linkExists.length === 0) {
    await db.insert(movieCategories).values({
      movieVid: movie.vid,
      categorySlug,
      position,
    });
  }
}

/** Sync a single category page. Returns the number of movies stored. */
export async function syncCategoryPage(
  categorySlug: string,
  page: number
): Promise<{ count: number; totalPages: number }> {
  const catInfo = SOURCE_CATEGORIES.find((c) => c.slug === categorySlug);
  if (!catInfo) throw new Error(`Unknown category: ${categorySlug}`);

  const result = await scrapeMoviesPage(categorySlug, page);

  // Upsert category with total pages
  await upsertCategory(categorySlug, catInfo.name, catInfo.nameAr, result.totalPages);

  // Upsert all movies
  for (let i = 0; i < result.movies.length; i++) {
    await upsertMovie(result.movies[i], categorySlug, (page - 1) * 40 + i);
  }

  // Log
  await db.insert(scrapingLog).values({
    categorySlug,
    page,
    moviesCount: result.movies.length,
  });

  return { count: result.movies.length, totalPages: result.totalPages };
}

/** Sync ALL pages of a category. Returns progress info. */
export async function syncFullCategory(
  categorySlug: string,
  onProgress?: (page: number, totalPages: number) => void
): Promise<{ totalMovies: number; totalPages: number }> {
  // First page to get totalPages
  const first = await syncCategoryPage(categorySlug, 1);
  onProgress?.(1, first.totalPages);

  // Remaining pages
  for (let p = 2; p <= first.totalPages; p++) {
    try {
      await syncCategoryPage(categorySlug, p);
      onProgress?.(p, first.totalPages);
    } catch (err) {
      console.error(`Error syncing ${categorySlug} page ${p}:`, err);
    }
  }

  return { totalMovies: first.totalPages * 40, totalPages: first.totalPages };
}

/** Get movies for a category from DB, sorted newest first, with pagination. */
export async function getCategoryMoviesFromDB(
  categorySlug: string,
  page: number = 1,
  perPage: number = 40
): Promise<{ movies: ScrapedMovie[]; total: number; totalPages: number }> {
  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(movieCategories)
    .where(eq(movieCategories.categorySlug, categorySlug));

  const total = countResult[0]?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const offset = (page - 1) * perPage;

  // Get movies joined with movie data, sorted by year desc
  const rows = await db
    .select({
      vid: movies.vid,
      title: movies.title,
      image: movies.image,
      duration: movies.duration,
      year: movies.year,
      sourceUrl: movies.sourceUrl,
    })
    .from(movieCategories)
    .innerJoin(movies, eq(movieCategories.movieVid, movies.vid))
    .where(eq(movieCategories.categorySlug, categorySlug))
    .orderBy(sql`${movies.year} desc nulls last, ${movieCategories.position} asc`)
    .limit(perPage)
    .offset(offset);

  return {
    movies: rows.map((r) => ({
      vid: r.vid,
      title: r.title,
      image: r.image || "",
      duration: r.duration || "",
      sourceUrl: r.sourceUrl || "",
      year: r.year,
    })),
    total,
    totalPages,
  };
}

/** Get overall stats. */
export async function getDBStats() {
  const movieCount = await db.select({ count: sql<number>`count(*)::int` }).from(movies);
  const catCount = await db.select({ count: sql<number>`count(*)::int` }).from(categories);
  const linkCount = await db.select({ count: sql<number>`count(*)::int` }).from(movieCategories);

  const catStats = await db
    .select({
      slug: categories.slug,
      nameAr: categories.nameAr,
      totalPages: categories.totalPages,
      lastScrapedPage: categories.lastScrapedPage,
    })
    .from(categories)
    .orderBy(categories.slug);

  return {
    totalMovies: movieCount[0]?.count || 0,
    totalCategories: catCount[0]?.count || 0,
    totalLinks: linkCount[0]?.count || 0,
    categories: catStats,
  };
}
