import { NextRequest, NextResponse } from "next/server";
import { deleteManualSubtitle } from "@/lib/manual-subtitle";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get("x-admin-api-key");
  const expectedKey = process.env.ADMIN_API_KEY;
  if (apiKey && expectedKey && apiKey === expectedKey) return true;
  return false;
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
