import { NextRequest, NextResponse } from "next/server";
import { filmbox } from "@/lib/filmbox-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { keyword, page = 0, perPage = 10, subjectType = "movie" } = body;
    if (!keyword) {
      return NextResponse.json({ error: "Missing keyword" }, { status: 400 });
    }
    const data = await filmbox.search(keyword, page, perPage, subjectType);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API filmbox/search] Error:", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Error", data: null },
      { status: 500 }
    );
  }
}
