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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const accounts = await dbCinemacity.listCookieAccounts();
    const masked = accounts.map((a) => ({
      ...a,
      cookies_json: undefined,
      cookie_count: (() => {
        try { return JSON.parse(a.cookies_json).length; } catch { return 0; }
      })(),
    }));
    return NextResponse.json({ accounts: masked, count: masked.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();

    if (!body.label || typeof body.label !== "string") {
      return NextResponse.json({ error: "Field 'label' is required" }, { status: 400 });
    }
    if (!Array.isArray(body.cookies) || body.cookies.length === 0) {
      return NextResponse.json({ error: "Field 'cookies' is required" }, { status: 400 });
    }

    const result = await dbCinemacity.upsertCookies({
      label: body.label,
      cookies: body.cookies,
      is_active: body.is_active !== false,
      notes: body.notes,
    });

    return NextResponse.json({
      ...result,
      success: true,
      message: result.updated ? "Cookies updated" : "Cookies created",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
