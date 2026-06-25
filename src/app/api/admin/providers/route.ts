/**
 * src/app/api/admin/providers/route.ts
 *
 * GET  /api/admin/providers       - List all providers (admin only)
 * POST /api/admin/providers       - Create new provider (admin only)
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

// === GET: List all providers (including inactive) ===
export async function GET() {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const providers = await dbProvider.listAll(true);
    return NextResponse.json({ providers });
  } catch (error) {
    console.error("[ADMIN PROVIDERS GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}

// === POST: Create new provider ===
export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const body = await request.json();

    // Validate required fields
    const required = ["name", "server_label", "embed_base", "movie_path", "tv_path"];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Field '${field}' is required` },
          { status: 400 }
        );
      }
    }

    const id = await dbProvider.create({
      name: body.name,
      server_label: body.server_label,
      embed_base: body.embed_base,
      movie_path: body.movie_path,
      tv_path: body.tv_path,
      brutality: Number(body.brutality ?? 0),
      is_active: body.is_active === false ? 0 : 1,
      sort_order: Number(body.sort_order ?? 0),
      api_key: body.api_key || null,
      api_key_param: body.api_key_param || null,
      debug_param: body.debug_param || null,
    });

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error("[ADMIN PROVIDERS POST]", error);
    return NextResponse.json(
      { error: "Failed to create provider" },
      { status: 500 }
    );
  }
}
