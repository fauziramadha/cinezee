/**
 * src/app/api/user/[id]/badges/route.ts
 *
 * GET /api/user/[id]/badges - Ambil semua badge milik user
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserBadges } from "@/lib/badge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const badges = await getUserBadges(userId);
    return NextResponse.json({ badges });
  } catch (error) {
    console.error("[GET USER BADGES ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch user badges" }, { status: 500 });
  }
}
