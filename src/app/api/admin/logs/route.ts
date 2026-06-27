/**
 * src/app/api/admin/logs/route.ts
 *
 * GET /api/admin/logs - List system logs with filters
 *
 * Query params:
 *   level    - debug|info|warn|error (optional)
 *   category - api|auth|db|cache|pwa|provider|message|user|system|security (optional)
 *   search   - search in message (optional)
 *   limit    - default 100, max 500
 *   offset   - for pagination
 *
 * DELETE /api/admin/logs - Clear all logs (older than X days)
 *   Query: olderThanDays=30 (default)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "admin") {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// === GET: List logs with filters ===
export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Build dynamic query
    const where: string[] = [];
    const params: any[] = [];

    if (level && ["debug", "info", "warn", "error"].includes(level)) {
      where.push("level = ?");
      params.push(level);
    }

    if (
      category &&
      ["api", "auth", "db", "cache", "pwa", "provider", "message", "user", "system", "security"].includes(category)
    ) {
      where.push("category = ?");
      params.push(category);
    }

    if (search) {
      where.push("message LIKE ?");
      params.push(`%${search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    // Get logs
    const logs = (
      await d1
        .prepare(
          `SELECT * FROM system_log ${whereClause}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        )
        .bind(...params, limit, offset)
        .all()
    ).results || [];

    // Get total count for pagination
    const total = await d1
      .prepare(`SELECT COUNT(*) as count FROM system_log ${whereClause}`)
      .bind(...params)
      .first<{ count: number }>();

    // Get stats summary
    const stats = await d1
      .prepare(
        `SELECT
           level,
           COUNT(*) as count
         FROM system_log
         GROUP BY level
         ORDER BY CASE level
           WHEN 'error' THEN 1
           WHEN 'warn' THEN 2
           WHEN 'info' THEN 3
           WHEN 'debug' THEN 4
         END`
      )
      .all();

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        total: total?.count || 0,
        limit,
        offset,
        hasMore: (total?.count || 0) > offset + limit,
      },
      stats: stats.results || [],
    });
  } catch (error: any) {
    console.error("[ADMIN LOGS GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}

// === DELETE: Clear old logs ===
export async function DELETE(request: NextRequest) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get("olderThanDays") || "30", 10);

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    const result = await d1
      .prepare(
        `DELETE FROM system_log
         WHERE created_at < datetime('now', ?)`
      )
      .bind(`-${olderThanDays} days`)
      .run();

    return NextResponse.json({
      success: true,
      message: `Logs older than ${olderThanDays} days deleted`,
      deleted: (result.meta as any)?.changes || 0,
    });
  } catch (error: any) {
    console.error("[ADMIN LOGS DELETE ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete logs" },
      { status: 500 },
    );
  }
}
