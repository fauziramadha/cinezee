import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { dbAd } from "@/lib/db-ad";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const ads = await dbAd.listAll();
    return NextResponse.json({ ads });
  } catch (error) {
    console.error("[ADMIN ADS GET]", error);
    return NextResponse.json({ error: "Failed to fetch ads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const body = await request.json();
    const id = await dbAd.create({
      name: body.name,
      image_url: body.image_url,
      click_url: body.click_url,
      position: body.position || "home_top",
      is_active: body.is_active ? 1 : 0,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
    });
    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error("[ADMIN ADS POST]", error);
    return NextResponse.json({ error: "Failed to create ad" }, { status: 500 });
  }
}
