/**
 * src/app/api/admin/providers/[id]/route.ts
 *
 * PUT    /api/admin/providers/:id   - Update provider
 * DELETE /api/admin/providers/:id   - Delete provider
 * PATCH  /api/admin/providers/:id   - Toggle active / reorder
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbProvider } from "@/lib/db-extended";

// === Helper: Check admin access ===
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if ((session.user as any).role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// === PUT: Update provider ===
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();

    await dbProvider.update(id, {
      name: body.name,
      server_label: body.server_label,
      embed_base: body.embed_base,
      movie_path: body.movie_path,
      tv_path: body.tv_path,
      brutality: body.brutality !== undefined ? Number(body.brutality) : undefined,
      is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : undefined,
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) : undefined,
      api_key: body.api_key,
      api_key_param: body.api_key_param,
      debug_param: body.debug_param,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN PROVIDERS PUT]", error);
    return NextResponse.json(
      { error: "Failed to update provider" },
      { status: 500 }
    );
  }
}

// === DELETE: Delete provider ===
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await dbProvider.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN PROVIDERS DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete provider" },
      { status: 500 }
    );
  }
}

// === PATCH: Quick toggle active or reorder ===
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();

    if (body.action === "toggle") {
      await dbProvider.toggleActive(id, Boolean(body.is_active));
    } else if (body.action === "reorder" && Array.isArray(body.orderedIds)) {
      await dbProvider.reorder(body.orderedIds);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN PROVIDERS PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update provider" },
      { status: 500 }
    );
  }
}
