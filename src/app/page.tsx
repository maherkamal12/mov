import { SOURCE_CATEGORIES, type ScrapedMovie } from "@/lib/scraper";
import { isDbAvailable } from "@/db";
import { getCategoryMoviesFromDB } from "@/lib/syncService";
import HomeClient from "./HomeClient";

interface CategoryRow {
  slug: string;
  name: string;
  nameAr: string;
  movies: ScrapedMovie[];
  totalMovies: number;
}

// ALL categories to show on homepage
const HOMEPAGE_CATEGORIES = SOURCE_CATEGORIES.map((c) => c.slug);

export default async function Home() {
  const categoryRows: CategoryRow[] = [];

  const dbReady = isDbAvailable();

  const results = await Promise.allSettled(
    HOMEPAGE_CATEGORIES.map(async (slug) => {
      const cat = SOURCE_CATEGORIES.find((c) => c.slug === slug);
      if (!cat) return null;

      // Try DB first if available
      if (dbReady) {
        try {
          const dbResult = await getCategoryMoviesFromDB(slug, 1, 20);
          if (dbResult.movies.length > 0) {
            return {
              slug,
              name: cat.name,
              nameAr: cat.nameAr,
              movies: dbResult.movies,
              totalMovies: dbResult.total,
            };
          }
        } catch {
          // DB query failed
        }
      }

      // Fallback: live scrape
      try {
        const { scrapeMoviesPage } = await import("@/lib/scraper");
        const result = await scrapeMoviesPage(slug, 1);
        if (result.movies.length > 0) {
          return {
            slug,
            name: cat.name,
            nameAr: cat.nameAr,
            movies: result.movies.slice(0, 20),
            totalMovies: result.totalPages * 40,
          };
        }
      } catch {
        // live also failed
      }

      return null;
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      categoryRows.push(r.value);
    }
  }

  return (
    <HomeClient
      categoryRows={categoryRows}
      allCategories={SOURCE_CATEGORIES}
    />
  );
}
