import { NextRequest, NextResponse } from "next/server";
import { syncCategoryPage, syncFullCategory, getDBStats } from "@/lib/syncService";
import { SOURCE_CATEGORIES } from "@/lib/scraper";

export const dynamic = "force-dynamic";

/** GET /api/sync - Get sync status/stats */
export async function GET() {
  try {
    const stats = await getDBStats();
    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        sourceCategories: SOURCE_CATEGORIES.map((c) => c.slug),
      },
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** POST /api/sync - Trigger sync
 *  Body: { category: string, page?: number, full?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, page, full } = body as {
      category?: string;
      page?: number;
      full?: boolean;
    };

    if (!category) {
      return NextResponse.json(
        { success: false, error: "category is required" },
        { status: 400 }
      );
    }

    if (full) {
      // Sync all pages — this is long-running, so we do it without awaiting
      // and return immediately. Client can poll /api/sync for progress.
      syncFullCategory(category).catch((err) =>
        console.error(`Background sync error for ${category}:`, err)
      );
      return NextResponse.json({
        success: true,
        message: `Started full sync for ${category}`,
      });
    }

    // Sync a single page
    const p = page || 1;
    const result = await syncCategoryPage(category, p);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error syncing:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
