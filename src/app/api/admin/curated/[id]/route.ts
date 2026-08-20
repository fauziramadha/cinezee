import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  throw new Error('D1 database binding "DB" not found.');
}

// PUT: Update status (Approve/Reject) atau edit URL
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const d1 = await getD1();
    const body = await req.json();
    
    const { status, stream_url, quality } = body;
    
    await d1.prepare(
      `UPDATE curated_movies 
       SET status = ?, stream_url = ?, quality = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(status || 'pending', stream_url || '', quality || 'HD', id).run();
    
    return NextResponse.json({ success: true, message: "Berhasil diupdate" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE: Hapus film dari daftar
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const d1 = await getD1();
    
    await d1.prepare("DELETE FROM curated_movies WHERE id = ?").bind(id).run();
    
    return NextResponse.json({ success: true, message: "Berhasil dihapus" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
