import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: Ambil config lengkap (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { D1 } = process as any;
    if (!D1) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const config = await D1.prepare("SELECT * FROM ads_config WHERE id = 1").first();

    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch ads config" },
      { status: 500 }
    );
  }
}

// PATCH: Update config (admin only)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { D1 } = process as any;
    if (!D1) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Build update query dinamis berdasarkan field yang dikirim
    const allowedFields = [
      "pre_roll_enabled",
      "hilltopads_preroll_url",
      "hilltopads_preroll_duration",
      "hilltopads_preroll_skip_delay",
      "monetag_popunder_url",
      "monetag_popunder_enabled",
      "adsterra_direct_link",
      "adsterra_enabled",
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push(`updated_at = datetime('now')`);
    values.push(1); // WHERE id = 1

    await D1.prepare(
      `UPDATE ads_config SET ${updates.join(", ")} WHERE id = ?`
    )
      .bind(...values)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update ads config" },
      { status: 500 }
    );
  }
}
