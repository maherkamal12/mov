import { NextRequest, NextResponse } from "next/server";
import { getVideoSources } from "@/lib/videoSources";

export const dynamic = "force-dynamic";

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

    const sources = await getVideoSources(vid);

    return NextResponse.json({
      success: true,
      data: { vid, sources },
    });
  } catch (error) {
    console.error("Error extracting video sources:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
