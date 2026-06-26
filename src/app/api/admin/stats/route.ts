import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Admin Stats API
 *
 * GET /api/admin/stats → Get overview statistics for dashboard
 * (Only accessible by users with role = "admin")
 *
 * Returns stats for: users, watchlist, history, ratings, comments,
 * notifications, messages, providers, plays + recent activity
 */

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Auth check: must be logged in AND be an admin
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // === Existing stats (run in parallel) ===
    const [users, watchlist, history, ratings, comments, notifications] = await Promise.all([
      d1.prepare("SELECT COUNT(*) as count FROM User").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM Watchlist").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM WatchHistory").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM Rating").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM Comment").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM Notification").first<{ count: number }>(),
    ]);

    // === Recent signups (last 7 days) ===
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    const recentUsers = await d1
      .prepare("SELECT COUNT(*) as count FROM User WHERE createdAt >= ?")
      .bind(sevenDaysAgoStr)
      .first<{ count: number }>();

    // === NEW: Messages stats (admin_message table) ===
    let messagesTotal = { count: 0 };
    let messagesBroadcast = { count: 0 };
    try {
      [messagesTotal, messagesBroadcast] = await Promise.all([
        d1.prepare("SELECT COUNT(*) as count FROM admin_message WHERE deleted_at IS NULL").first<{ count: number }>(),
        d1.prepare("SELECT COUNT(*) as count FROM admin_message WHERE deleted_at IS NULL AND recipient_id IS NULL").first<{ count: number }>(),
      ]);
    } catch {
      // admin_message table might not exist yet
    }

    // === NEW: Providers stats (provider_config table) ===
    let providersTotal = { count: 0 };
    let providersActive = { count: 0 };
    try {
      [providersTotal, providersActive] = await Promise.all([
        d1.prepare("SELECT COUNT(*) as count FROM provider_config").first<{ count: number }>(),
        d1.prepare("SELECT COUNT(*) as count FROM provider_config WHERE is_active = 1").first<{ count: number }>(),
      ]);
    } catch {
      // provider_config table might not exist yet
    }

    // === NEW: Plays stats (AnalyticsEvent table) ===
    let playsTotal = { count: 0 };
    let playsThisWeek = { count: 0 };
    try {
      [playsTotal, playsThisWeek] = await Promise.all([
        d1.prepare("SELECT COUNT(*) as count FROM AnalyticsEvent").first<{ count: number }>(),
        d1.prepare("SELECT COUNT(*) as count FROM AnalyticsEvent WHERE createdAt >= ?").bind(sevenDaysAgoStr).first<{ count: number }>(),
      ]);
    } catch {
      // AnalyticsEvent table might not exist yet
    }

    // === NEW: Recent messages (last 5) ===
    let recentMessages: any[] = [];
    try {
      recentMessages = (
        await d1
          .prepare(
            `SELECT id, sender_name, recipient_id, recipient_name, subject, body, type, created_at
             FROM admin_message
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT 5`
          )
          .all()
      ).results || [];
    } catch {
      // admin_message table might not exist
    }

    // === NEW: Recent plays (last 5) ===
    let recentPlays: any[] = [];
    try {
      recentPlays = (
        await d1
          .prepare(
            `SELECT * FROM AnalyticsEvent ORDER BY createdAt DESC LIMIT 5`
          )
          .all()
      ).results || [];
    } catch {
      // AnalyticsEvent table might not exist
    }

    // === NEW: Recent users (last 5 signups) ===
    let recentUsersList: any[] = [];
    try {
      recentUsersList = (
        await d1
          .prepare(
            `SELECT id, name, email, image, createdAt
             FROM User
             ORDER BY createdAt DESC
             LIMIT 5`
          )
          .all()
      ).results || [];
    } catch {
      // fallback
    }

    return NextResponse.json({
      success: true,
      stats: {
        // Existing stats (backward compatible)
        totalUsers: users?.count || 0,
        recentUsers: recentUsers?.count || 0,
        totalWatchlist: watchlist?.count || 0,
        totalHistory: history?.count || 0,
        totalRatings: ratings?.count || 0,
        totalComments: comments?.count || 0,
        totalNotifications: notifications?.count || 0,

        // NEW stats
        totalMessages: (messagesTotal as any)?.count || 0,
        broadcastMessages: (messagesBroadcast as any)?.count || 0,
        totalProviders: (providersTotal as any)?.count || 0,
        activeProviders: (providersActive as any)?.count || 0,
        totalPlays: (playsTotal as any)?.count || 0,
        playsThisWeek: (playsThisWeek as any)?.count || 0,
      },
      recentMessages,
      recentPlays,
      recentUsers: recentUsersList,
    });
  } catch (error: any) {
    console.error("[ADMIN STATS GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
