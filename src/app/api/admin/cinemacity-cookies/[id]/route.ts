import { NextRequest, NextResponse } from "next/server";
import { dbCinemacity } from "@/lib/db-extended";

async function requireAdmin(request: NextRequest): Promise<
  | { error: NextResponse }
  | { ok: true }
> {
  const apiKey = request.headers.get("x-admin-api-key");
  const expectedKey = process.env.ADMIN_API_KEY;
  if (apiKey && expectedKey && apiKey === expectedKey) {
    return { ok: true };
  }

  try {
    const { getServerSession } = await import("next-auth");
    const authMod = await import("@/lib/auth").catch(() => null);
    if (authMod?.authOptions) {
      const session = await getServerSession(authMod.authOptions);
      if (session?.user && (session.user as any).role === "admin") {
        return { ok: true };
      }
    }
  } catch {}

  return {
    error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await request.json();

    if (body.set_active === true) {
      await dbCinemacity.setActiveAccount(id);
    }

    if (body.cookies && Array.isArray(body.cookies)) {
      await dbCinemacity.upsertCookies({
        label: `account_${id}`,
        cookies: body.cookies,
      });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await dbCinemacity.deleteCookies(id);
  return NextResponse.json({ success: true, id });
}
