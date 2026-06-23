import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Admin Stats API
 *
 * GET /api/admin/stats → Get overview statistics for dashboard
 * (Only accessible by users with role = "admin")
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

    // Run all count queries in parallel for speed
    const [users, watchlist, history, ratings, comments, notifications] = await Promise.all([
      d1.prepare("SELECT COUNT(*) as count FROM User").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM Watchlist").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM WatchHistory").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM Rating").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM Comment").first<{ count: number }>(),
      d1.prepare("SELECT COUNT(*) as count FROM Notification").first<{ count: number }>(),
    ]);

    // Get recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    const recentUsers = await d1
      .prepare("SELECT COUNT(*) as count FROM User WHERE createdAt >= ?")
      .bind(sevenDaysAgoStr)
      .first<{ count: number }>();

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: users?.count || 0,
        recentUsers: recentUsers?.count || 0,
        totalWatchlist: watchlist?.count || 0,
        totalHistory: history?.count || 0,
        totalRatings: ratings?.count || 0,
        totalComments: comments?.count || 0,
        totalNotifications: notifications?.count || 0,
      },
    });
  } catch (error: any) {
    console.error("[ADMIN STATS GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
