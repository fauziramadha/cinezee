import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  throw new Error('D1 database binding "DB" not found.');
}

// GET: Ambil semua film yang sudah di-curate
export async function GET() {
  try {
    const d1 = await getD1();
    const { results } = await d1.prepare(
      "SELECT * FROM curated_movies ORDER BY created_at DESC LIMIT 100"
    ).all();
    
    return NextResponse.json({ success: true, data: results || [] });
  } catch (error: any) {
    console.error("[Admin Curated GET] Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST: Tambah film baru ke daftar curate
export async function POST(req: NextRequest) {
  try {
    const d1 = await getD1();
    const body = await req.json();
    
    const { tmdb_id, tmdb_type, title, poster_path, stream_url, stream_type, quality, status } = body;
    
    if (!tmdb_id || !tmdb_type) {
      return NextResponse.json({ success: false, message: "tmdb_id dan tmdb_type wajib diisi" }, { status: 400 });
    }
    
    await d1.prepare(
      `INSERT INTO curated_movies (tmdb_id, tmdb_type, title, poster_path, stream_url, stream_type, quality, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tmdb_id, tmdb_type) DO UPDATE SET
         stream_url = excluded.stream_url,
         stream_type = excluded.stream_type,
         quality = excluded.quality,
         status = excluded.status,
         updated_at = datetime('now')`
    ).bind(
      tmdb_id, 
      tmdb_type, 
      title || "", 
      poster_path || "", 
      stream_url || "", 
      stream_type || "iframe", 
      quality || "HD", 
      status || "pending"
    ).run();
    
    return NextResponse.json({ success: true, message: "Film berhasil disimpan" });
  } catch (error: any) {
    console.error("[Admin Curated POST] Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
