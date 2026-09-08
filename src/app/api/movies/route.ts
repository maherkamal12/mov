import { NextRequest, NextResponse } from "next/server";
import { scrapeMoviesPage } from "@/lib/scraper";
import { isDbAvailable } from "@/db";
import { getCategoryMoviesFromDB } from "@/lib/syncService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "arabic-movies";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const source = searchParams.get("source"); // "db" or "live"

    // Try DB first (fast), unless source=live or DB unavailable
    if (source !== "live" && isDbAvailable()) {
      try {
        const dbResult = await getCategoryMoviesFromDB(category, page);
        if (dbResult.movies.length > 0) {
          return NextResponse.json({
            success: true,
            data: {
              movies: dbResult.movies,
              totalPages: dbResult.totalPages,
              currentPage: page,
              source: "database",
            },
          });
        }
      } catch {
        // DB query failed, fall through to live
      }
    }

    // Fallback: live scrape
    const result = await scrapeMoviesPage(category, page);

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        source: "live",
      },
    });
  } catch (error) {
    console.error("Error fetching movies:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
