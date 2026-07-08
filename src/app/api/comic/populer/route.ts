import { NextRequest, NextResponse } from "next/server";
import { comic } from "@/lib/comic-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") || "1";
    const data = await comic.getPopuler(parseInt(page, 10));
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
