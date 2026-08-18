import { NextRequest, NextResponse } from "next/server";
import { deleteManualSubtitle, getManualSubtitleById } from "@/lib/manual-subtitle";

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

// FIX C: GET handler - fetch single subtitle by ID (untuk edit mode)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const subtitle = await getManualSubtitleById(idNum);
  if (!subtitle) {
    return NextResponse.json({ error: "Subtitle not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, subtitle });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await deleteManualSubtitle(idNum);
  return NextResponse.json({ success: true, id: idNum });
}
