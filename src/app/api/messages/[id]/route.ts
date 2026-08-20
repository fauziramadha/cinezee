/**
 * src/app/api/messages/[id]/route.ts
 *
 * PATCH /api/messages/:id - Mark single message as read
 *
 * Dipakai saat user klik message di bell dropdown.
 * - Insert ke admin_message_read dengan (message_id, user_id, now())
 * - Gunakan INSERT OR IGNORE agar tidak duplikat (UNIQUE constraint)
 * - Hanya butuh user login (bukan admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbMessage } from "@/lib/db-extended";

// === PATCH: Mark message as read ===
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const userId = (session.user as any).id;
    await dbMessage.markAsRead(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[USER MESSAGE PATCH]", error);
    return NextResponse.json(
      { error: "Failed to mark message as read" },
      { status: 500 }
    );
  }
}
