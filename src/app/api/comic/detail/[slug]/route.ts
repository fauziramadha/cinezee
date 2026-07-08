import { NextRequest, NextResponse } from "next/server";
import { comic } from "@/lib/comic-api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug.replace(/\/+$/, "").trim();
    const data = await comic.getDetail(cleanSlug);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API comic/detail] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        statusCode: 500,
        message: error?.message || "Error fetching comic detail",
        ok: false,
        data: null,
      },
      { status: 500 }
    );
  }
}
