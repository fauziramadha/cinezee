/**
 * src/app/api/messages/route.ts
 *
 * Endpoint publik untuk user yang sudah login.
 *
 * GET   /api/messages         - Get current user's messages (direct + broadcast)
 * PATCH /api/messages         - Mark all as read
 *
 * Response GET:
 *   {
 *     messages: AdminMessageWithMeta[],
 *     unreadCount: number
 *   }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbMessage } from "@/lib/db-extended";

// === GET: Get my messages + unread count ===
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;
    const messages = await dbMessage.listForUser(userId);
    const unreadCount = await dbMessage.countUnread(userId);
    return NextResponse.json({ messages, unreadCount });
  } catch (error) {
    console.error("[USER MESSAGES GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// === PATCH: Mark all my messages as read ===
export async function PATCH() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;
    await dbMessage.markAllAsRead(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[USER MESSAGES PATCH]", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
