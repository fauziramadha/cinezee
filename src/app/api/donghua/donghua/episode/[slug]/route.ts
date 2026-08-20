import { NextRequest, NextResponse } from "next/server";
import { s1 } from "@/lib/donghua-api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug.replace(/\/$/, "");
    const data = await s1.getEpisode(cleanSlug);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API donghua/episode] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        statusCode: 500,
        message: error?.message || "Error fetching Donghua data",
        ok: false,
        data: null,
      },
      { status: 500 }
    );
  }
}
