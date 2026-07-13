import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  throw new Error("D1 not found");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tmdb_id: string }> }
) {
  try {
    const { tmdb_id } = await params;
    const d1 = await getD1();

    const row = await d1
      .prepare("SELECT * FROM curated_movies WHERE tmdb_id = ? AND status = ?")
      .bind(parseInt(tmdb_id, 10), "approved")
      .first();

    if (!row) {
      return NextResponse.json({ success: false, curated: false });
    }

    return NextResponse.json({
      success: true,
      curated: true,
      data: row,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
