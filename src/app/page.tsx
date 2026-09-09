import { SOURCE_CATEGORIES, type ScrapedMovie } from "@/lib/scraper";
import { isDbAvailable, pool } from "@/db";
import HomeClient from "./HomeClient";

interface CategoryRow {
  slug: string;
  name: string;
  nameAr: string;
  movies: ScrapedMovie[];
  totalMovies: number;
}

const HOMEPAGE_CATEGORIES = SOURCE_CATEGORIES.map((c) => c.slug);

export default async function Home() {
  const categoryRows: CategoryRow[] = [];
  const dbReady = isDbAvailable() && pool;

  const results = await Promise.allSettled(
    HOMEPAGE_CATEGORIES.map(async (slug) => {
      const cat = SOURCE_CATEGORIES.find((c) => c.slug === slug);
      if (!cat) return null;

      // Try DB first
      if (dbReady) {
        try {
          const client = await pool!.connect();
          try {
            const countRes = await client.query(
              `SELECT count(*)::int as c FROM movie_categories WHERE category_slug = $1`,
              [slug]
            );
            const total = countRes.rows[0]?.c || 0;
            if (total > 0) {
              const moviesRes = await client.query(
                `SELECT m.vid, m.title, m.image, m.duration, m.year, m.source_url
                 FROM movie_categories mc JOIN movies m ON mc.movie_vid = m.vid
                 WHERE mc.category_slug = $1
                 ORDER BY m.year DESC NULLS LAST, mc.position ASC
                 LIMIT 20`,
                [slug]
              );
              const movies: ScrapedMovie[] = moviesRes.rows.map((r: Record<string, unknown>) => ({
                vid: String(r.vid), title: String(r.title), image: r.image ? String(r.image) : "",
                duration: r.duration ? String(r.duration) : "", sourceUrl: r.source_url ? String(r.source_url) : "",
                year: r.year as number | null,
              }));
              if (movies.length > 0) {
                return { slug, name: cat.name, nameAr: cat.nameAr, movies, totalMovies: total };
              }
            }
          } finally {
            client.release();
          }
        } catch {
          // DB failed
        }
      }

      // Fallback: live scrape
      try {
        const { scrapeMoviesPage } = await import("@/lib/scraper");
        const result = await scrapeMoviesPage(slug, 1);
        if (result.movies.length > 0) {
          return { slug, name: cat.name, nameAr: cat.nameAr, movies: result.movies.slice(0, 20), totalMovies: result.totalPages * 40 };
        }
      } catch {
        // live also failed
      }

      return null;
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) categoryRows.push(r.value);
  }

  return <HomeClient categoryRows={categoryRows} allCategories={SOURCE_CATEGORIES} />;
}
