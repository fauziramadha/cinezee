/**
 * src/app/api/admin/messages/route.ts
 *
 * GET  /api/admin/messages        - List all messages sent (admin only)
 * POST /api/admin/messages        - Send message (to user or broadcast)
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

// === GET: List all messages with stats ===
export async function GET() {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const messages = await dbMessage.listAll();

    // Attach recipient count for each message
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const stats = await dbMessage.getStats(msg.id);
        return {
          ...msg,
          recipient_count: stats.recipientCount,
          read_count: stats.readCount,
        };
      })
    );

    return NextResponse.json({ messages: enriched });
  } catch (error) {
    console.error("[ADMIN MESSAGES GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// === POST: Send message ===
// Body:
//   { recipientId: string | null,  // null = broadcast to all
//     recipientName?: string,
//     subject?: string,
//     body: string,
//     type?: "info" | "warning" | "announcement" | "system",
//     isPinned?: boolean,
//     expiresAt?: string | null }
export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const body = await request.json();

    if (!body.body || body.body.trim().length === 0) {
      return NextResponse.json(
        { error: "Message body is required" },
        { status: 400 }
      );
    }

    const messageId = await dbMessage.send({
      senderId: (adminCheck as any).session.user.id,
      senderName: (adminCheck as any).session.user.name || null,
      recipientId: body.recipientId || null, // null = broadcast
      recipientName: body.recipientName || null,
      subject: body.subject || null,
      body: body.body,
      type: body.type || "info",
      isPinned: Boolean(body.isPinned),
      expiresAt: body.expiresAt || null,
    });

    return NextResponse.json({ id: messageId, success: true });
  } catch (error) {
    console.error("[ADMIN MESSAGES POST]", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
