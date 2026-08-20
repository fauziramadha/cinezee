import { NextRequest, NextResponse } from "next/server";
import { comic } from "@/lib/comic-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") || "1";
    const tipe = searchParams.get("tipe") || "";
    const orderby = searchParams.get("orderby") || "";
    const genre = searchParams.get("genre") || "";

    // Build endpoint with all relevant params
    let endpoint = `/populer?page=${page}`;
    if (tipe) endpoint += `&tipe=${encodeURIComponent(tipe)}`;
    if (orderby) endpoint += `&orderby=${encodeURIComponent(orderby)}`;
    if (genre) endpoint += `&genre=${encodeURIComponent(genre)}`;

    const data = await comic.getPopulerFiltered(endpoint);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API comic/populer] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        statusCode: 500,
        message: error?.message || "Error fetching comic populer",
        ok: false,
        data: null,
      },
      { status: 500 }
    );
  }
}
