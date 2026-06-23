import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  // Step 1: Environment variables
  results.steps.push({
    step: "1. Environment Variables",
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
  });

  // Step 2: D1 binding
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext();
    results.steps.push({
      step: "2. D1 Binding",
      success: !!ctx?.env?.DB,
    });
  } catch (e: any) {
    results.steps.push({ step: "2. D1 Binding", success: false, error: e.message });
  }

  // Step 3: Raw D1 tables
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;
    const stmt = d1.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    const tables = await stmt.all();
    results.steps.push({
      step: "3. Raw D1 Query (tables)",
      success: true,
      tables: tables.results?.map((t: any) => t.name) || [],
    });
  } catch (e: any) {
    results.steps.push({ step: "3. Raw D1 Query", success: false, error: e.message });
  }

  // Step 4: db.user.count()
  try {
    const userCount = await db.user.count();
    results.steps.push({
      step: "4. db.user.count()",
      success: true,
      userCount,
    });
  } catch (e: any) {
    results.steps.push({ step: "4. db.user.count()", success: false, error: e.message });
  }

  // Step 5: Bcrypt
  try {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("test", 10);
    const valid = await bcrypt.compare("test", hash);
    results.steps.push({ step: "5. Bcrypt Test", success: valid });
  } catch (e: any) {
    results.steps.push({ step: "5. Bcrypt Test", success: false, error: e.message });
  }

  return NextResponse.json(results);
}
