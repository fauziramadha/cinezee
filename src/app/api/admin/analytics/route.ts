/**
 * src/app/api/admin/analytics/route.ts
 *
 * GET /api/admin/analytics?range=7|30|90
 *
 * Returns analytics data for charts:
 * - Overview stats (total plays, unique viewers, etc)
 * - Daily plays chart (last N days)
 * - Top movies/TV (by play count)
 * - Plays by media type
 * - Top active users
 * - Recent activity feed
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

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

    const { searchParams } = new URL(request.url);
    const range = parseInt(searchParams.get("range") || "7", 10);
    // Valid range: 7, 14, 30, 90 days
    const days = [7, 14, 30, 90].includes(range) ? range : 7;

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - days);
    const startDateStr = startDate.toISOString();

    // === Helper: Safe query (return null if table doesn't exist) ===
    const safeQuery = async <T>(sql: string, params: any[] = []): Promise<T[] | null> => {
      try {
        const result = await d1.prepare(sql).bind(...params).all();
        return (result.results as T[]) || [];
      } catch {
        return null;
      }
    };

    const safeFirst = async <T>(sql: string, params: any[] = []): Promise<T | null> => {
      try {
        return await d1.prepare(sql).bind(...params).first<T>();
      } catch {
        return null;
      }
    };

    // ============================================================
    // 1. OVERVIEW STATS
    // ============================================================
    const [totalPlays, playsInRange, uniqueViewers, uniqueMovies] = await Promise.all([
      safeFirst<{ count: number }>("SELECT COUNT(*) as count FROM AnalyticsEvent"),
      safeFirst<{ count: number }>(
        "SELECT COUNT(*) as count FROM AnalyticsEvent WHERE createdAt >= ?",
        [startDateStr]
      ),
      safeFirst<{ count: number }>(
        "SELECT COUNT(DISTINCT userId) as count FROM AnalyticsEvent WHERE createdAt >= ?",
        [startDateStr]
      ),
      safeFirst<{ count: number }>(
        "SELECT COUNT(DISTINCT mediaId) as count FROM AnalyticsEvent WHERE createdAt >= ?",
        [startDateStr]
      ),
    ]);

    // ============================================================
    // 2. DAILY PLAYS CHART (last N days)
    // ============================================================
    const dailyPlays = await safeQuery<{ date: string; count: number }>(
      `SELECT DATE(createdAt) as date, COUNT(*) as count
       FROM AnalyticsEvent
       WHERE createdAt >= ?
       GROUP BY DATE(createdAt)
       ORDER BY date ASC`,
      [startDateStr]
    );

    // Fill missing days with 0 (for chart continuity)
    const dailyPlaysChart: Array<{ date: string; count: number }> = [];
    if (dailyPlays) {
      const dateMap = new Map(dailyPlays.map((d) => [d.date, d.count]));
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        dailyPlaysChart.push({
          date: dateStr,
          count: dateMap.get(dateStr) || 0,
        });
      }
    }

    // ============================================================
    // 3. TOP MOVIES & TV (by play count)
    // ============================================================
    const topMovies = await safeQuery<{
      mediaId: number;
      title: string;
      count: number;
    }>(
      `SELECT mediaId, title, COUNT(*) as count
       FROM AnalyticsEvent
       WHERE mediaType = 'movie' AND createdAt >= ?
       GROUP BY mediaId, title
       ORDER BY count DESC
       LIMIT 10`,
      [startDateStr]
    );

    const topTV = await safeQuery<{
      mediaId: number;
      title: string;
      count: number;
    }>(
      `SELECT mediaId, title, COUNT(*) as count
       FROM AnalyticsEvent
       WHERE mediaType = 'tv' AND createdAt >= ?
       GROUP BY mediaId, title
       ORDER BY count DESC
       LIMIT 10`,
      [startDateStr]
    );

    // ============================================================
    // 4. PLAYS BY MEDIA TYPE
    // ============================================================
    const playsByType = await safeQuery<{ mediaType: string; count: number }>(
      `SELECT mediaType, COUNT(*) as count
       FROM AnalyticsEvent
       WHERE createdAt >= ?
       GROUP BY mediaType`,
      [startDateStr]
    );

    const movieCount = playsByType?.find((p) => p.mediaType === "movie")?.count || 0;
    const tvCount = playsByType?.find((p) => p.mediaType === "tv")?.count || 0;

    // ============================================================
    // 5. TOP ACTIVE USERS
    // ============================================================
    const topUsers = await safeQuery<{
      userId: string;
      count: number;
    }>(
      `SELECT userId, COUNT(*) as count
       FROM AnalyticsEvent
       WHERE createdAt >= ? AND userId IS NOT NULL
       GROUP BY userId
       ORDER BY count DESC
       LIMIT 10`,
      [startDateStr]
    );

    // Get user details for top users
    let topUsersEnriched: Array<{
      userId: string;
      name: string | null;
      email: string | null;
      image: string | null;
      count: number;
    }> = [];

    if (topUsers && topUsers.length > 0) {
      const userIds = topUsers.map((u) => u.userId);
      // Build placeholders for IN clause
      const placeholders = userIds.map(() => "?").join(",");
      const userDetails = await safeQuery<{
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      }>(
        `SELECT id, name, email, image FROM User WHERE id IN (${placeholders})`,
        userIds
      );

      if (userDetails) {
        const userMap = new Map(userDetails.map((u) => [u.id, u]));
        topUsersEnriched = topUsers.map((tu) => ({
          userId: tu.userId,
          name: userMap.get(tu.userId)?.name || null,
          email: userMap.get(tu.userId)?.email || null,
          image: userMap.get(tu.userId)?.image || null,
          count: tu.count,
        }));
      }
    }

    // ============================================================
    // 6. HOURLY PLAYS (today, last 24 hours)
    // ============================================================
    const last24h = new Date();
    last24h.setHours(now.getHours() - 24);
    const last24hStr = last24h.toISOString();

    const hourlyPlays = await safeQuery<{ hour: number; count: number }>(
      `SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as count
       FROM AnalyticsEvent
       WHERE createdAt >= ?
       GROUP BY hour
       ORDER BY hour ASC`,
      [last24hStr]
    );

    // Fill all 24 hours
    const hourlyChart: Array<{ hour: number; count: number }> = [];
    for (let h = 0; h < 24; h++) {
      const found = hourlyPlays?.find((p) => p.hour === h);
      hourlyChart.push({
        hour: h,
        count: found?.count || 0,
      });
    }

    // ============================================================
    // 7. RECENT ACTIVITY (last 10 plays)
    // ============================================================
    const recentActivity = await safeQuery<{
      id: string;
      mediaId: number;
      mediaType: string;
      title: string;
      userId: string;
      eventType: string;
      createdAt: string;
    }>(
      `SELECT * FROM AnalyticsEvent
       ORDER BY createdAt DESC
       LIMIT 10`,
      []
    );

    // ============================================================
    // 8. EVENT TYPES BREAKDOWN
    // ============================================================
    const eventTypes = await safeQuery<{ eventType: string; count: number }>(
      `SELECT eventType, COUNT(*) as count
       FROM AnalyticsEvent
       WHERE createdAt >= ?
       GROUP BY eventType
       ORDER BY count DESC`,
      [startDateStr]
    );

    // ============================================================
    // RESPONSE
    // ============================================================
    return NextResponse.json({
      success: true,
      range: days,
      overview: {
        totalPlays: totalPlays?.count || 0,
        playsInRange: playsInRange?.count || 0,
        uniqueViewers: uniqueViewers?.count || 0,
        uniqueMedia: uniqueMovies?.count || 0,
      },
      charts: {
        daily: dailyPlaysChart,
        hourly: hourlyChart,
      },
      topContent: {
        movies: topMovies || [],
        tv: topTV || [],
      },
      mediaTypeBreakdown: {
        movie: movieCount,
        tv: tvCount,
      },
      topUsers: topUsersEnriched,
      eventTypes: eventTypes || [],
      recentActivity: recentActivity || [],
    });
  } catch (error: any) {
    console.error("[ADMIN ANALYTICS GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
