import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Watch History API (Continue Watching)
 *
 * GET  /api/history              → Get user's watch history (sorted by recent)
 * POST /api/history              → Add/update watch history (upsert)
 *   Body: { mediaId, mediaType, title, posterPath, backdropPath, season?, episode?, progress? }
 * DELETE /api/history?id=xxx     → Remove specific item
 * DELETE /api/history?clear=all  → Clear all history
 */

function generateId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// =====================================================
// GET — List user's watch history (Continue Watching)
// =====================================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Get history sorted by most recent first
    const result = await d1
      .prepare("SELECT * FROM WatchHistory WHERE userId = ? ORDER BY updatedAt DESC LIMIT 20")
      .bind(session.user.id)
      .all();

    return NextResponse.json({
      success: true,
      history: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error: any) {
    console.error("[HISTORY GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch history" },
      { status: 500 },
    );
  }
}

// =====================================================
// POST — Add or update watch history (Upsert)
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
    const {
      mediaId,
      mediaType,
      title,
      posterPath,
      backdropPath,
      season = null,
      episode = null,
      progress = 0,
    } = body;

    // Validate required fields
    if (!mediaId || !mediaType || !title) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: mediaId, mediaType, title" },
        { status: 400 },
      );
    }

    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { success: false, error: "mediaType must be 'movie' or 'tv'" },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;
    const now = new Date().toISOString();

    // Check if already exists (for upsert)
    const existing = await d1
      .prepare(
        "SELECT id FROM WatchHistory WHERE userId = ? AND mediaId = ? AND mediaType = ?",
      )
      .bind(session.user.id, mediaId, mediaType)
      .first();

    if (existing) {
      // UPDATE existing record
      await d1
        .prepare(
          `UPDATE WatchHistory 
           SET title = ?, posterPath = ?, backdropPath = ?, season = ?, episode = ?, progress = ?, updatedAt = ?
           WHERE id = ? AND userId = ?`,
        )
        .bind(
          title,
          posterPath || null,
          backdropPath || null,
          season,
          episode,
          progress,
          now,
          existing.id,
          session.user.id,
        )
        .run();

      return NextResponse.json({
        success: true,
        id: existing.id,
        message: "History updated",
      });
    } else {
      // INSERT new record
      const id = generateId();
      await d1
        .prepare(
          `INSERT INTO WatchHistory (id, userId, mediaId, mediaType, title, posterPath, backdropPath, season, episode, progress, watchedAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          session.user.id,
          mediaId,
          mediaType,
          title,
          posterPath || null,
          backdropPath || null,
          season,
          episode,
          progress,
          now,
          now,
        )
        .run();

      return NextResponse.json(
        {
          success: true,
          id,
          message: "Added to history",
        },
        { status: 201 },
      );
    }
  } catch (error: any) {
    console.error("[HISTORY POST ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to save history" },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE — Remove item(s) from history
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

    // Clear all history
    if (clear === "all") {
      await d1
        .prepare("DELETE FROM WatchHistory WHERE userId = ?")
        .bind(session.user.id)
        .run();

      return NextResponse.json({
        success: true,
        message: "All history cleared",
      });
    }

    // Delete specific item
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing 'id' query parameter or 'clear=all'" },
        { status: 400 },
      );
    }

    await d1
      .prepare("DELETE FROM WatchHistory WHERE id = ? AND userId = ?")
      .bind(id, session.user.id)
      .run();

    return NextResponse.json({
      success: true,
      message: "Removed from history",
    });
  } catch (error: any) {
    console.error("[HISTORY DELETE ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove from history" },
      { status: 500 },
    );
  }
}
