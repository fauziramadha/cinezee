import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getKV() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.VIDAPI_KV || null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdb");

  if (!imdbId || !imdbId.startsWith("tt")) {
    return NextResponse.json({ error: "Invalid IMDB ID" }, { status: 400 });
  }

  const kv = await getKV();
  if (!kv) return NextResponse.json({ error: "KV not connected" }, { status: 500 });

  try {
    // Baca key kecil dari KV (instant, 0 CPU time)
    const json = await kv.get(`eps_${imdbId}`);
    
    if (json) {
      const seasons = JSON.parse(json);
      return NextResponse.json({ seasons });
    }

    return NextResponse.json({ seasons: [] });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
