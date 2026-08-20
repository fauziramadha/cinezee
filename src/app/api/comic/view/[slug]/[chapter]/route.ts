import { NextRequest, NextResponse } from "next/server";
import { comic } from "@/lib/comic-api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; chapter: string }> }
) {
  try {
    const { slug, chapter } = await params;
    const cleanSlug = slug.replace(/\/+$/, "").trim();
    const cleanChapter = chapter.replace(/\/+$/, "").trim();
    const data = await comic.getView(cleanSlug, cleanChapter);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API comic/view] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        statusCode: 500,
        message: error?.message || "Error fetching comic view",
        ok: false,
        data: null,
      },
      { status: 500 }
    );
  }
}
