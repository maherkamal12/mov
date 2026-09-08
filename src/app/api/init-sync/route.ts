import { NextResponse } from "next/server";
import { syncCategoryPage, getDBStats } from "@/lib/syncService";
import { SOURCE_CATEGORIES } from "@/lib/scraper";

export const dynamic = "force-dynamic";

/**
 * GET /api/init-sync
 * Syncs the first page of EVERY category to populate the homepage quickly.
 * The full sync (all pages) should be triggered separately per category.
 */
export async function GET() {
  try {
    const stats = await getDBStats();

    // If we already have movies, skip
    if (stats.totalMovies > 0) {
      return NextResponse.json({
        success: true,
        message: "Database already populated",
        data: stats,
      });
    }

    // Sync page 1 of each category
    const results: Record<string, { count: number; totalPages: number }> = {};

    for (const cat of SOURCE_CATEGORIES) {
      try {
        const result = await syncCategoryPage(cat.slug, 1);
        results[cat.slug] = result;
      } catch (err) {
        console.error(`Error syncing ${cat.slug}:`, err);
        results[cat.slug] = { count: 0, totalPages: 0 };
      }
    }

    const newStats = await getDBStats();

    return NextResponse.json({
      success: true,
      message: "Initial sync complete",
      data: { results, stats: newStats },
    });
  } catch (error) {
    console.error("Error in init-sync:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
