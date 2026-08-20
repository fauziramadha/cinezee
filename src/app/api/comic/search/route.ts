import { NextRequest, NextResponse } from "next/server";
import { comic } from "@/lib/comic-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    if (!q) {
      return NextResponse.json({ items: [] });
    }
    const data = await comic.search(q);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API comic/search] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        statusCode: 500,
        message: error?.message || "Error searching comic",
        ok: false,
        data: null,
      },
      { status: 500 }
    );
  }
}
