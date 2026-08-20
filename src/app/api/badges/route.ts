/**
 * src/app/api/badges/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllBadges, assignBadgeToUser, revokeBadgeFromUser } from "@/lib/badge";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get("x-admin-api-key");
  const expectedKey = process.env.ADMIN_API_KEY;
  if (apiKey && expectedKey && apiKey === expectedKey) return true;
  
  try {
    const { getServerSession } = await import("next-auth");
    const authMod = await import("@/lib/auth").catch(() => null);
    if (authMod?.authOptions) {
      const session = await getServerSession(authMod.authOptions);
      if (session?.user && (session.user as any).role === "admin") return true;
    }
  } catch {}
  return false;
}

export async function GET() {
  try {
    const badges = await getAllBadges();
    return NextResponse.json({ badges });
  } catch (error) {
    console.error("[GET BADGES ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch badges" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId, badgeId, expiresAt } = await request.json();
    if (!userId || !badgeId) {
      return NextResponse.json({ error: "userId and badgeId are required" }, { status: 400 });
    }

    await assignBadgeToUser(userId, badgeId, expiresAt);
    return NextResponse.json({ success: true, message: "Badge assigned" });
  } catch (error) {
    console.error("[ASSIGN BADGE ERROR]", error);
    return NextResponse.json({ error: "Failed to assign badge" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId, badgeId } = await request.json();
    if (!userId || !badgeId) {
      return NextResponse.json({ error: "userId and badgeId are required" }, { status: 400 });
    }

    await revokeBadgeFromUser(userId, badgeId);
    return NextResponse.json({ success: true, message: "Badge revoked" });
  } catch (error) {
    console.error("[REVOKE BADGE ERROR]", error);
    return NextResponse.json({ error: "Failed to revoke badge" }, { status: 500 });
  }
}
