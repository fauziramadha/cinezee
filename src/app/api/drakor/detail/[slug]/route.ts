import { NextRequest, NextResponse } from "next/server";
import { drakor } from "@/lib/drakor-api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = slug.replace(/\/+$/, "").trim();
    const data = await drakor.getDetail(cleanSlug);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API drakor/detail] Error:", error);
    return NextResponse.json(
      { status: "error", statusCode: 500, message: error?.message || "Error", ok: false, data: null },
      { status: 500 }
    );
  }
}
