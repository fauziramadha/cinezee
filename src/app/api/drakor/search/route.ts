import { NextRequest, NextResponse } from "next/server";
import { drakor } from "@/lib/drakor-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const page = searchParams.get("page") || "1";
    if (!q) return NextResponse.json({ items: [] });
    const data = await drakor.search(q, parseInt(page, 10));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API drakor/search] Error:", error);
    return NextResponse.json(
      { status: "error", statusCode: 500, message: error?.message || "Error", ok: false, data: null },
      { status: 500 }
    );
  }
}
