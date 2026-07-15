import { NextRequest, NextResponse } from "next/server";
import { upsertManualSubtitle, listManualSubtitles } from "@/lib/manual-subtitle";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get("x-admin-api-key");
  const expectedKey = process.env.ADMIN_API_KEY;
  if (apiKey && expectedKey && apiKey === expectedKey) return true;
  try {
    const { getServerSession } = await import("next-auth");
    const authMod = await import("@/lib/auth").catch(() => null);
    if (authMod?.authOptions) {
      const session = await getServerSession(authMod.authOptions);
      if (session?.user && (session.user as any).role === "admin") return true;
    }
  } catch {}
  return false;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || undefined;
    const subtitles = await listManualSubtitles(search);
    return NextResponse.json({ subtitles, count: subtitles.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    if (!body.title || !body.type || !body.subtitle_text) {
      return NextResponse.json(
        { error: "Fields 'title', 'type', 'subtitle_text' are required" },
        { status: 400 }
      );
    }
    const result = await upsertManualSubtitle({
      title: body.title,
      type: body.type,
      season: body.season,
      episode: body.episode,
      server: body.server,
      quality: body.quality,
      subtitle_text: body.subtitle_text,
      release_name: body.release_name,
    });
    return NextResponse.json({
      ...result,
      success: true,
      message: result.updated ? "Subtitle updated" : "Subtitle created",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed", detail: String(error) }, { status: 500 });
  }
}
