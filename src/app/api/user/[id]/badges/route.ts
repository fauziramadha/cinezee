/**
 * src/app/api/user/[id]/badges/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserInfoAndBadges } from "@/lib/badge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const { user, badges } = await getUserInfoAndBadges(userId);
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user, badges });
  } catch (error) {
    console.error("[GET USER BADGES ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch user badges" }, { status: 500 });
  }
}
