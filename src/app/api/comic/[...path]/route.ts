import { NextRequest, NextResponse } from "next/server";
import { fetchComicAPI } from "@/lib/comic-api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const searchParams = request.nextUrl.searchParams;
    let endpoint = "/comic/" + path.join("/");
    const queryString = searchParams.toString();
    if (queryString) endpoint += `?${queryString}`;
    const data = await fetchComicAPI(endpoint);
    const response = NextResponse.json(data);
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return response;
  } catch (error) {
    console.error("[Comic Proxy] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("status 429") ? 429 : message.includes("status 404") ? 404 : 500;
    return NextResponse.json({ status: "error", statusCode: status, message: status === 429 ? "Rate limit exceeded." : message, ok: false, data: null }, { status });
  }
}
