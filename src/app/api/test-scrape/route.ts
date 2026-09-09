import { NextResponse } from "next/server";
import { scrapeMoviesPage } from "@/lib/scraper";

export const dynamic = "force-dynamic";

/**
 * GET /api/test-scrape
 * Tests if scraping from the source site works.
 */
export async function GET() {
  const results: { test: string; ok: boolean; error?: string; data?: string }[] = [];

  // Test 1: Basic fetch
  try {
    const res = await fetch("https://a.qfilm.tv/category.php?cat=arabic-movies", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ar,en-US;q=0.7,en;q=0.3",
      },
      signal: AbortSignal.timeout(15000),
    });
    results.push({
      test: "Fetch qfilm.tv",
      ok: res.ok,
      data: `Status: ${res.status}, Content-Type: ${res.headers.get("content-type")}`,
    });
  } catch (e) {
    results.push({
      test: "Fetch qfilm.tv",
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    });
  }

  // Test 2: Parse movies
  try {
    const result = await scrapeMoviesPage("arabic-movies", 1);
    results.push({
      test: "Parse movies",
      ok: result.movies.length > 0,
      data: `Found ${result.movies.length} movies, totalPages: ${result.totalPages}. First: ${result.movies[0]?.title || "none"}`,
    });
  } catch (e) {
    results.push({
      test: "Parse movies",
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    });
  }

  // Test 3: Database
  try {
    const { isDbAvailable, pool } = await import("@/db");
    if (!isDbAvailable() || !pool) {
      results.push({ test: "Database", ok: false, error: "DATABASE_URL not set" });
    } else {
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
        const r = await client.query("SELECT count(*)::int as c FROM movies");
        results.push({
          test: "Database",
          ok: true,
          data: `Connected. Movies: ${r.rows[0]?.c || 0}`,
        });
      } finally {
        client.release();
      }
    }
  } catch (e) {
    results.push({
      test: "Database",
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    });
  }

  return NextResponse.json({ success: true, results });
}
