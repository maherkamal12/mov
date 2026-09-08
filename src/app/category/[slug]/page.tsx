import { NextRequest } from "next/server";
import { getCategoryMoviesFromDB } from "@/lib/syncService";
import { scrapeMoviesPage, SOURCE_CATEGORIES, type ScrapedMovie } from "@/lib/scraper";
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

  // Try DB first
  try {
    const dbResult = await getCategoryMoviesFromDB(slug, page, 40);
    if (dbResult.movies.length > 0) {
      movies = dbResult.movies;
      totalPages = dbResult.totalPages;
    }
  } catch {
    // DB not ready
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

  return (
    <CategoryClient
      slug={slug}
      nameAr={nameAr}
      initialMovies={movies}
      initialTotalPages={totalPages}
      initialPage={page}
    />
  );
}
