import { NextResponse } from "next/server";

// HAPUS "export const runtime = 'edge'" - biarkan pakai Node.js default

export async function GET() {
  try {
    const tmdbVars: Record<string, string> = {};

    if (typeof process !== "undefined" && process.env) {
      Object.keys(process.env).forEach((key) => {
        if (key.toUpperCase().includes("TMDB")) {
          const val = process.env[key] || "";
          tmdbVars[key] = val.length > 8
            ? val.slice(0, 4) + "..." + val.slice(-4)
            : "(too short: " + val.length + " chars)";
        }
      });
    }

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      runtime: "nodejs",
      process_env_exists: typeof process !== "undefined",
      process_env_keys_count: typeof process !== "undefined" ? Object.keys(process.env).length : 0,
      tmdb_vars_found: Object.keys(tmdbVars).length,
      tmdb_vars: tmdbVars,
      all_env_keys: typeof process !== "undefined" ? Object.keys(process.env) : [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { 
        error: "Debug route crashed", 
        message: err?.message || String(err),
        stack: err?.stack?.split("\n").slice(0, 5),
      },
      { status: 500 }
    );
  }
}
