import { NextRequest, NextResponse } from "next/server";
import { dbAd } from "@/lib/db-ad";

/**
 * GET /api/ads?position=home_top
 * Fetch active ads for public display
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get("position") || "home_top";

    const ads = await dbAd.listActive(position);

    // Increment impressions for all returned ads (fire and forget)
    ads.forEach((ad) => {
      dbAd.incrementImpression(ad.id).catch(() => {});
    });

    return NextResponse.json(
      { ads },
      { headers: { "Cache-Control": "no-store" } } // Don't cache, so impressions are accurate
    );
  } catch (error) {
    console.error("[ADS GET]", error);
    return NextResponse.json({ ads: [] }, { status: 500 });
  }
}
