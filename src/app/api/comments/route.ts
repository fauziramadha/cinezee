import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Comments API (with nested replies)
 *
 * GET  /api/comments?mediaId=123&mediaType=movie → Get all comments for a media (tree structure)
 * POST /api/comments                              → Add a comment or reply
 *   Body: { mediaId, mediaType, content, parentId? }
 * DELETE /api/comments?id=xxx                     → Delete a comment (and its replies)
 */

function generateId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

interface RawComment {
  id: string;
  userId: string;
  mediaId: number;
  mediaType: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userImage: string | null;
}

interface CommentTree extends RawComment {
  replies: CommentTree[];
}

// Build nested tree from flat comment list
function buildCommentTree(comments: RawComment[]): CommentTree[] {
  const map = new Map<string, CommentTree>();
  const roots: CommentTree[] = [];

  // First pass: create nodes
  for (const comment of comments) {
    map.set(comment.id, { ...comment, replies: [] });
  }

  // Second pass: build tree
  for (const comment of comments) {
    const node = map.get(comment.id)!;
    if (comment.parentId && map.has(comment.parentId)) {
      map.get(comment.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// =====================================================
// GET — Get all comments for a media (tree structure)
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

    // Fetch all comments for this media (join with User)
    const result = await d1
      .prepare(
        `SELECT c.id, c.userId, c.mediaId, c.mediaType, c.content, c.parentId, c.createdAt, c.updatedAt,
                u.name as userName, u.image as userImage
         FROM Comment c
         JOIN User u ON c.userId = u.id
         WHERE c.mediaId = ? AND c.mediaType = ?
         ORDER BY c.createdAt ASC`,
      )
      .bind(parseInt(mediaId), mediaType)
      .all();

    // Build nested tree
    const comments = (result.results || []) as unknown as RawComment[];
    const commentTree = buildCommentTree(comments);

    // Sort top-level by newest first, but replies oldest first (conversation order)
    commentTree.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      comments: commentTree,
      totalCount: comments.length,
    });
  } catch (error: any) {
    console.error("[COMMENTS GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch comments" },
      { status: 500 },
    );
  }
}

// =====================================================
// POST — Add a comment or reply
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
    const { mediaId, mediaType, content, parentId } = body;

    if (!mediaId || !mediaType || !content) {
      return NextResponse.json(
        { success: false, error: "Missing mediaId, mediaType, or content" },
        { status: 400 },
      );
    }

    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { success: false, error: "mediaType must be 'movie' or 'tv'" },
        { status: 400 },
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Comment cannot be empty" },
        { status: 400 },
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Comment too long (max 2000 chars)" },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // If parentId is provided, verify it exists and belongs to same media
    if (parentId) {
      const parent = await d1
        .prepare("SELECT id FROM Comment WHERE id = ? AND mediaId = ? AND mediaType = ?")
        .bind(parentId, mediaId, mediaType)
        .first();
      
      if (!parent) {
        return NextResponse.json(
          { success: false, error: "Parent comment not found" },
          { status: 404 },
        );
      }
    }

    const id = generateId();
    const now = new Date().toISOString();

    await d1
      .prepare(
        "INSERT INTO Comment (id, userId, mediaId, mediaType, content, parentId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        session.user.id,
        mediaId,
        mediaType,
        content.trim(),
        parentId || null,
        now,
        now,
      )
      .run();

    return NextResponse.json(
      {
        success: true,
        id,
        message: "Comment added",
        user: {
          id: session.user.id,
          name: session.user.name,
          image: session.user.image,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[COMMENTS POST ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to add comment" },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE — Delete a comment (and its replies via CASCADE)
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

    // Check ownership (or admin can delete any)
    const comment = await d1
      .prepare("SELECT userId FROM Comment WHERE id = ?")
      .bind(id)
      .first<{ userId: string }>();

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 },
      );
    }

    const isAdmin = session.user.role === "admin";
    if (comment.userId !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden - you can only delete your own comments" },
        { status: 403 },
      );
    }

    // Delete (CASCADE will remove replies automatically)
    await d1.prepare("DELETE FROM Comment WHERE id = ?").bind(id).run();

    return NextResponse.json({
      success: true,
      message: "Comment deleted",
    });
  } catch (error: any) {
    console.error("[COMMENTS DELETE ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete comment" },
      { status: 500 },
    );
  }
}
