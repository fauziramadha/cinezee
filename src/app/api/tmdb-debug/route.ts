import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  // List semua env vars yang mengandung "TMDB"
  const tmdbVars: Record<string, string> = {};
  
  if (typeof process !== "undefined" && process.env) {
    Object.keys(process.env).forEach((key) => {
      if (key.includes("TMDB") || key.includes("tmdb")) {
        const val = process.env[key] || "";
        // Mask middle of API key for security
        tmdbVars[key] = val.length > 8 
          ? val.slice(0, 4) + "..." + val.slice(-4) 
          : "(too short)";
      }
    });
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    runtime: "edge",
    process_env_exists: typeof process !== "undefined",
    process_env_keys_count: typeof process !== "undefined" ? Object.keys(process.env).length : 0,
    tmdb_vars_found: Object.keys(tmdbVars).length,
    tmdb_vars: tmdbVars,
    sample_env_keys: typeof process !== "undefined" 
      ? Object.keys(process.env).slice(0, 10) 
      : [],
  });
}
