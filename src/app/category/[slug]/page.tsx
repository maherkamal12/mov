import { scrapeMoviesPage, SOURCE_CATEGORIES, type ScrapedMovie } from "@/lib/scraper";
import { isDbAvailable, pool } from "@/db";
import CategoryClient from "./CategoryClient";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const cat = SOURCE_CATEGORIES.find((c) => c.slug === slug);
  return {
    title: `${cat?.nameAr || slug} - سينمافlix`,
    description: `مشاهدة أفلام ${cat?.nameAr || slug} اون لاين بجودة عالية HD`,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);
  const cat = SOURCE_CATEGORIES.find((c) => c.slug === slug);
  const nameAr = cat?.nameAr || slug;

  let movies: ScrapedMovie[] = [];
  let totalPages = 1;
  const perPage = 40;

  // Try DB first
  if (isDbAvailable() && pool) {
    try {
      const client = await pool.connect();
      try {
        const countRes = await client.query(
          `SELECT count(*)::int as c FROM movie_categories WHERE category_slug = $1`,
          [slug]
        );
        const total = countRes.rows[0]?.c || 0;
        if (total > 0) {
          totalPages = Math.max(1, Math.ceil(total / perPage));
          const offset = (page - 1) * perPage;
          const moviesRes = await client.query(
            `SELECT m.vid, m.title, m.image, m.duration, m.year, m.source_url
             FROM movie_categories mc JOIN movies m ON mc.movie_vid = m.vid
             WHERE mc.category_slug = $1
             ORDER BY m.year DESC NULLS LAST, mc.position ASC
             LIMIT $2 OFFSET $3`,
            [slug, perPage, offset]
          );
          movies = moviesRes.rows.map((r: Record<string, unknown>) => ({
            vid: String(r.vid), title: String(r.title), image: r.image ? String(r.image) : "",
            duration: r.duration ? String(r.duration) : "", sourceUrl: r.source_url ? String(r.source_url) : "",
            year: r.year as number | null,
          }));
        }
      } finally {
        client.release();
      }
    } catch { /* DB failed */ }
  }

  // Fallback: live scrape
  if (movies.length === 0) {
    try {
      const result = await scrapeMoviesPage(slug, page);
      movies = result.movies;
      totalPages = result.totalPages;
    } catch (error) {
      console.error(`Failed to fetch category ${slug}:`, error);
    }
  }

  return <CategoryClient slug={slug} nameAr={nameAr} initialMovies={movies} initialTotalPages={totalPages} initialPage={page} />;
}
