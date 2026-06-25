/**
 * src/app/api/admin/messages/[id]/route.ts
 *
 * DELETE /api/admin/messages/:id    - Soft delete message
 * PATCH  /api/admin/messages/:id    - Toggle pinned
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbMessage } from "@/lib/db-extended";

// === Helper: Check admin access ===
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if ((session.user as any).role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// === DELETE: Soft delete message ===
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await dbMessage.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN MESSAGES DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}

// === PATCH: Toggle pin/unpin ===
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();

    if (body.action === "pin") {
      await dbMessage.setPinned(id, Boolean(body.is_pinned));
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN MESSAGES PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}
