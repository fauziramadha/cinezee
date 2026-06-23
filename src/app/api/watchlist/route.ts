import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Watchlist API
 *
 * GET  /api/watchlist          → Get user's watchlist
 * POST /api/watchlist          → Add item to watchlist
 *   Body: { mediaId, mediaType, title, posterPath, backdropPath }
 * DELETE /api/watchlist?id=xxx → Remove item from watchlist
 */

function generateId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// =====================================================
// GET — List user's watchlist
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

    const result = await d1
      .prepare("SELECT * FROM Watchlist WHERE userId = ? ORDER BY addedAt DESC")
      .bind(session.user.id)
      .all();

    return NextResponse.json({
      success: true,
      watchlist: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error: any) {
    console.error("[WATCHLIST GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch watchlist" },
      { status: 500 },
    );
  }
}

// =====================================================
// POST — Add item to watchlist
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
    const { mediaId, mediaType, title, posterPath, backdropPath } = body;

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

    // Check if already in watchlist
    const existing = await d1
      .prepare(
        "SELECT id FROM Watchlist WHERE userId = ? AND mediaId = ? AND mediaType = ?",
      )
      .bind(session.user.id, mediaId, mediaType)
      .first();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Already in watchlist" },
        { status: 409 },
      );
    }

    // Insert new watchlist item
    const id = generateId();
    const now = new Date().toISOString();

    await d1
      .prepare(
        "INSERT INTO Watchlist (id, userId, mediaId, mediaType, title, posterPath, backdropPath, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        session.user.id,
        mediaId,
        mediaType,
        title,
        posterPath || null,
        backdropPath || null,
        now,
      )
      .run();

    return NextResponse.json(
      {
        success: true,
        id,
        message: "Added to watchlist",
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[WATCHLIST POST ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to add to watchlist" },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE — Remove item from watchlist
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

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing 'id' query parameter" },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Delete (only if belongs to this user)
    const result = await d1
      .prepare("DELETE FROM Watchlist WHERE id = ? AND userId = ?")
      .bind(id, session.user.id)
      .run();

    return NextResponse.json({
      success: true,
      message: "Removed from watchlist",
    });
  } catch (error: any) {
    console.error("[WATCHLIST DELETE ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove from watchlist" },
      { status: 500 },
    );
  }
}
