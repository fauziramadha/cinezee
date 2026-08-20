import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Admin Users API
 *
 * GET    /api/admin/users          → List all users
 * PATCH  /api/admin/users?id=xxx   → Update user role or ban status
 *    Body: { role?: "user"|"admin", banned?: boolean }
 * DELETE /api/admin/users?id=xxx   → Delete user
 */

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }), session: null };
  }
  if (session.user.role !== "admin") {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

// =====================================================
// GET — List all users
// =====================================================
export async function GET() {
  try {
    const { error, session } = await checkAdmin();
    if (error || !session) return error;

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    const result = await d1
      .prepare(
        `SELECT id, name, email, image, role, banned, createdAt 
         FROM User 
         ORDER BY createdAt DESC`,
      )
      .all();

    return NextResponse.json({
      success: true,
      users: result.results || [],
    });
  } catch (error: any) {
    console.error("[ADMIN USERS GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}

// =====================================================
// PATCH — Update role or ban status
// =====================================================
export async function PATCH(request: NextRequest) {
  try {
    const { error, session } = await checkAdmin();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing 'id' query parameter" },
        { status: 400 },
      );
    }

    // Prevent admin from demoting/banning themselves
    if (id === session.user.id) {
      return NextResponse.json(
        { success: false, error: "You cannot modify your own account" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { role, banned } = body;

    if (role && role !== "user" && role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Build update query dynamically
    const sets: string[] = [];
    const values: any[] = [];

    if (role) {
      sets.push("role = ?");
      values.push(role);
    }
    if (banned !== undefined) {
      sets.push("banned = ?");
      values.push(banned ? 1 : 0);
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    values.push(id);

    await d1
      .prepare(`UPDATE User SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return NextResponse.json({
      success: true,
      message: "User updated",
    });
  } catch (error: any) {
    console.error("[ADMIN USERS PATCH ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE — Delete user
// =====================================================
export async function DELETE(request: NextRequest) {
  try {
    const { error, session } = await checkAdmin();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing 'id' query parameter" },
        { status: 400 },
      );
    }

    // Prevent admin from deleting themselves
    if (id === session.user.id) {
      return NextResponse.json(
        { success: false, error: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    await d1.prepare("DELETE FROM User WHERE id = ?").bind(id).run();

    return NextResponse.json({
      success: true,
      message: "User deleted",
    });
  } catch (error: any) {
    console.error("[ADMIN USERS DELETE ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
