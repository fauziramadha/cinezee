import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const searchParams = request.nextUrl.searchParams;

    const apiKey = process.env.INDOCAST_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "INDOCAST_API_KEY not set in environment" }, { status: 500 });
    }

    // Build endpoint (e.g., /api/komiku/populer)
    const endpoint = "/api/" + path.join("/");
    
    // Append query params (page, tipe, orderby, q)
    const queryString = searchParams.toString();
    const url = `https://indocast.site${endpoint}${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, {
      headers: {
        // Asumsi API Key dikirim via header Authorization atau x-api-key
        // Kalau ternyata via query param (?apikey=...), kita bisa ubah ini
        "x-api-key": apiKey,
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent": "CineStream/1.0",
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const response = NextResponse.json(data);
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return response;
  } catch (error) {
    console.error("[Indocast Proxy] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
