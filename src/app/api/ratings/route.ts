import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Ratings & Reviews API
 *
 * GET  /api/ratings?mediaId=123&mediaType=movie  → Get all ratings for a media + user's rating
 * POST /api/ratings                              → Add/update user's rating (upsert)
 *   Body: { mediaId, mediaType, rating, review? }
 * DELETE /api/ratings?mediaId=123&mediaType=movie → Delete user's rating
 */

function generateId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// =====================================================
// GET — Get ratings for a media (and user's specific rating)
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("mediaId");
    const mediaType = searchParams.get("mediaType");

    if (!mediaId || !mediaType) {
      return NextResponse.json(
        { success: false, error: "Missing mediaId or mediaType" },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Get session to check if user is logged in
    const session = await getServerSession(authOptions);

    // Fetch all ratings for this media (join with User to get name/image)
    const allRatings = await d1
      .prepare(
        `SELECT r.id, r.rating, r.review, r.createdAt, r.updatedAt, 
                u.id as userId, u.name, u.image 
         FROM Rating r 
         JOIN User u ON r.userId = u.id 
         WHERE r.mediaId = ? AND r.mediaType = ? 
         ORDER BY r.createdAt DESC`,
      )
      .bind(parseInt(mediaId), mediaType)
      .all();

    // If user is logged in, find their specific rating
    let userRating = null;
    if (session?.user?.id) {
      userRating = await d1
        .prepare(
          "SELECT id, rating, review FROM Rating WHERE userId = ? AND mediaId = ? AND mediaType = ?",
        )
        .bind(session.user.id, parseInt(mediaId), mediaType)
        .first();
    }

    // Calculate average rating
    const ratings = allRatings.results || [];
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length
      : 0;

    return NextResponse.json({
      success: true,
      ratings: ratings,
      userRating: userRating,
      averageRating: avgRating,
      totalCount: ratings.length,
    });
  } catch (error: any) {
    console.error("[RATINGS GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch ratings" },
      { status: 500 },
    );
  }
}

// =====================================================
// POST — Add or update rating (Upsert)
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
    const { mediaId, mediaType, rating, review } = body;

    if (!mediaId || !mediaType || rating === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing mediaId, mediaType, or rating" },
        { status: 400 },
      );
    }

    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { success: false, error: "mediaType must be 'movie' or 'tv'" },
        { status: 400 },
      );
    }

    if (rating < 0 || rating > 10) {
      return NextResponse.json(
        { success: false, error: "Rating must be between 0 and 10" },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;
    const now = new Date().toISOString();

    // Check if user already rated this media
    const existing = await d1
      .prepare(
        "SELECT id FROM Rating WHERE userId = ? AND mediaId = ? AND mediaType = ?",
      )
      .bind(session.user.id, mediaId, mediaType)
      .first();

    if (existing) {
      // UPDATE
      await d1
        .prepare(
          "UPDATE Rating SET rating = ?, review = ?, updatedAt = ? WHERE id = ? AND userId = ?",
        )
        .bind(rating, review || null, now, existing.id, session.user.id)
        .run();

      return NextResponse.json({
        success: true,
        id: existing.id,
        message: "Rating updated",
      });
    } else {
      // INSERT
      const id = generateId();
      await d1
        .prepare(
          "INSERT INTO Rating (id, userId, mediaId, mediaType, rating, review, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id, session.user.id, mediaId, mediaType, rating, review || null, now, now)
        .run();

      return NextResponse.json(
        { success: true, id, message: "Rating added" },
        { status: 201 },
      );
    }
  } catch (error: any) {
    console.error("[RATINGS POST ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to save rating" },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE — Remove user's rating
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
    const mediaId = searchParams.get("mediaId");
    const mediaType = searchParams.get("mediaType");

    if (!mediaId || !mediaType) {
      return NextResponse.json(
        { success: false, error: "Missing mediaId or mediaType" },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    await d1
      .prepare(
        "DELETE FROM Rating WHERE userId = ? AND mediaId = ? AND mediaType = ?",
      )
      .bind(session.user.id, parseInt(mediaId), mediaType)
      .run();

    return NextResponse.json({
      success: true,
      message: "Rating deleted",
    });
  } catch (error: any) {
    console.error("[RATINGS DELETE ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete rating" },
      { status: 500 },
    );
  }
}
