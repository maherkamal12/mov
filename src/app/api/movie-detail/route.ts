import { NextRequest, NextResponse } from "next/server";
import { scrapeMovieDetail } from "@/lib/scraper";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vid = searchParams.get("vid");

    if (!vid) {
      return NextResponse.json(
        { success: false, error: "vid parameter is required" },
        { status: 400 }
      );
    }

    const result = await scrapeMovieDetail(vid);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error scraping movie detail:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
