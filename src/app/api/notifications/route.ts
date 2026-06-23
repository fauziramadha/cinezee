import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Notifications API
 *
 * GET  /api/notifications          → Get all user's notifications
 * GET  /api/notifications?unread=true → Get only unread notifications
 * POST /api/notifications          → Create notification (Admin only)
 *   Body: { userId, type, title, message, data? }
 * PATCH /api/notifications?id=xxx  → Mark as read
 * PATCH /api/notifications?clear=all → Mark all as read
 * DELETE /api/notifications?id=xxx → Delete specific notification
 * DELETE /api/notifications?clear=all → Delete all notifications
 */

function generateId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// =====================================================
// GET — List user's notifications
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    let query = "SELECT * FROM Notification WHERE userId = ?";
    const params: any[] = [session.user.id];

    if (unreadOnly) {
      query += " AND read = 0";
    }

    query += " ORDER BY createdAt DESC LIMIT 50";

    const stmt = d1.prepare(query).bind(...params);
    const result = await stmt.all();

    // Count unread
    const unreadResult = await d1
      .prepare("SELECT COUNT(*) as count FROM Notification WHERE userId = ? AND read = 0")
      .bind(session.user.id)
      .first<{ count: number }>();

    return NextResponse.json({
      success: true,
      notifications: result.results || [],
      unreadCount: unreadResult?.count || 0,
    });
  } catch (error: any) {
    console.error("[NOTIFICATIONS GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}

// =====================================================
// POST — Create notification (Admin only, or system)
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { userId, type, title, message, data } = body;

    // Target user: either specified (admin) or self
    const targetUserId = userId || session.user.id;

    // If sending to another user, must be admin
    if (targetUserId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden - admin access required" },
        { status: 403 },
      );
    }

    if (!type || !title || !message) {
      return NextResponse.json(
        { success: false, error: "Missing type, title, or message" },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    const id = generateId();
    const now = new Date().toISOString();

    await d1
      .prepare(
        "INSERT INTO Notification (id, userId, type, title, message, data, read, createdAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
      )
      .bind(
        id,
        targetUserId,
        type,
        title,
        message,
        data ? JSON.stringify(data) : null,
        now,
      )
      .run();

    return NextResponse.json(
      {
        success: true,
        id,
        message: "Notification created",
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[NOTIFICATIONS POST ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create notification" },
      { status: 500 },
    );
  }
}

// =====================================================
// PATCH — Mark as read / Mark all as read
// =====================================================
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clear = searchParams.get("clear");

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Mark all as read
    if (clear === "all") {
      await d1
        .prepare("UPDATE Notification SET read = 1 WHERE userId = ? AND read = 0")
        .bind(session.user.id)
        .run();

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
      });
    }

    // Mark specific as read
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing 'id' or 'clear=all'" },
        { status: 400 },
      );
    }

    await d1
      .prepare("UPDATE Notification SET read = 1 WHERE id = ? AND userId = ?")
      .bind(id, session.user.id)
      .run();

    return NextResponse.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error: any) {
    console.error("[NOTIFICATIONS PATCH ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notification" },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE — Delete notification(s)
// =====================================================
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clear = searchParams.get("clear");

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Delete all
    if (clear === "all") {
      await d1
        .prepare("DELETE FROM Notification WHERE userId = ?")
        .bind(session.user.id)
        .run();

      return NextResponse.json({
        success: true,
        message: "All notifications deleted",
      });
    }

    // Delete specific
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing 'id' or 'clear=all'" },
        { status: 400 },
      );
    }

    await d1
      .prepare("DELETE FROM Notification WHERE id = ? AND userId = ?")
      .bind(id, session.user.id)
      .run();

    return NextResponse.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error: any) {
    console.error("[NOTIFICATIONS DELETE ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}
