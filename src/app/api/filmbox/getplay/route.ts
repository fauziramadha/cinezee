import { NextRequest, NextResponse } from "next/server";
import { filmbox } from "@/lib/filmbox-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get("subjectId");
    const detailPath = searchParams.get("detailPath");
    const se = searchParams.get("se") || "0";
    const ep = searchParams.get("ep") || "0";
    const lang = searchParams.get("lang") || "in_id";

    if (!subjectId || !detailPath) {
      return NextResponse.json(
        { error: "Missing subjectId or detailPath" },
        { status: 400 }
      );
    }

    const data = await filmbox.getPlay(
      subjectId,
      detailPath,
      parseInt(se, 10),
      parseInt(ep, 10),
      lang
    );
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API filmbox/getplay] Error:", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Error", data: null },
      { status: 500 }
    );
  }
}
