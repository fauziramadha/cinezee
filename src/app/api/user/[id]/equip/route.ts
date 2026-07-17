/**
 * src/app/api/user/[id]/equip/route.ts
 *
 * POST /api/user/[id]/equip - Pasang badge (set equipped = 1)
 */

import { NextRequest, NextResponse } from "next/server";
import { equipBadge } from "@/lib/badge";
import { getServerSession } from "next-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  // Auth: User cuma bisa equip badge miliknya sendiri
  try {
    const { getServerSession } = await import("next-auth");
    const authMod = await import("@/lib/auth").catch(() => null);
    if (authMod?.authOptions) {
      const session = await getServerSession(authMod.authOptions);
      if (!session?.user || session.user.id !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  } catch {}

  try {
    const { badgeId } = await request.json();
    if (!badgeId) {
      return NextResponse.json({ error: "badgeId is required" }, { status: 400 });
    }

    await equipBadge(userId, badgeId);
    return NextResponse.json({ success: true, message: "Badge equipped" });
  } catch (error) {
    console.error("[EQUIP BADGE ERROR]", error);
    return NextResponse.json({ error: "Failed to equip badge" }, { status: 500 });
  }
}
