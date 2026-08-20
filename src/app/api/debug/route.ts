import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.TMDB_API_KEY;
  return NextResponse.json({
    hasKey: !!apiKey,
    keyLength: apiKey?.length || 0,
    keyPrefix: apiKey ? `${apiKey.substring(0, 4)}...` : null,
    message: apiKey
      ? "✅ TMDB API key found! Real data should work."
      : "❌ TMDB API key NOT found. Using mock data.",
  });
}
