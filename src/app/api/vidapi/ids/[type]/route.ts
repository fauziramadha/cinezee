import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch { return null; }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params;
    if (!["movie", "tv"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const db = await getDB();
    if (!db) {
      return NextResponse.json({ error: "DB not connected" }, { status: 500 });
    }

    const key = type === "movie" ? "movie_ids" : "tv_ids";
    const row = await db.prepare(
      "SELECT value FROM vidapi_sync_data WHERE key = ?"
    ).bind(key).first();

    if (row?.value) {
      const ids = JSON.parse(row.value as string);
      console.log(`[D1] Got ${ids.length} ${type} IDs from DB`);
      return NextResponse.json({ ids, count: ids.length });
    }

    return NextResponse.json({ ids: [], count: 0 });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
