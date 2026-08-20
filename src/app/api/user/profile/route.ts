/**
 * src/app/api/user/profile/route.ts
 *
 * GET  /api/user/profile - Ambil profil sendiri (bio, avatar)
 * POST /api/user/profile - Update profil sendiri (bio, avatar)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    const user = await d1
      .prepare("SELECT name, email, image, bio FROM User WHERE id = ?")
      .bind(session.user.id)
      .first<{ name: string; email: string; image: string | null; bio: string | null }>();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[GET PROFILE ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { avatar, bio } = await request.json();

    // Limit avatar size to 100KB (base64 string)
    if (avatar && avatar.length > 100000) {
      return NextResponse.json({ error: "Image too large (max 100KB)" }, { status: 400 });
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    await d1
      .prepare("UPDATE User SET image = ?, bio = ? WHERE id = ?")
      .bind(avatar || null, bio || null, session.user.id)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[UPDATE PROFILE ERROR]", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
