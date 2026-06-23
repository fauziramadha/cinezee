import { NextResponse } from "next/server";

/**
 * Debug endpoint untuk cek database connection
 * GET /api/debug-db
 */

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  // Step 1: Cek environment variables
  results.steps.push({
    step: "1. Environment Variables",
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
  });

  // Step 2: Coba akses D1 binding
  let d1Binding: D1Database | null = null;
  const bindingMethods: string[] = [];

  try {
    const mod = await import("@opennextjs/cloudflare");
    if (mod.getCloudflareContext) {
      bindingMethods.push("getCloudflareContext found");
      const ctx = await mod.getCloudflareContext();
      if (ctx?.env?.DB) {
        d1Binding = ctx.env.DB;
        bindingMethods.push("getCloudflareContext: DB found!");
      } else {
        bindingMethods.push("getCloudflareContext: DB NOT found in env");
      }
    } else {
      bindingMethods.push("getCloudflareContext NOT exported");
    }
  } catch (e: any) {
    bindingMethods.push(`getCloudflareContext error: ${e.message}`);
  }

  results.steps.push({
    step: "2. D1 Binding Methods",
    methods: bindingMethods,
    d1Found: !!d1Binding,
  });

  if (!d1Binding) {
    return NextResponse.json({
      ...results,
      error: "D1 binding NOT FOUND.",
    });
  }

  // Step 3: Raw SQL query ke D1
  try {
    const stmt = d1Binding.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    const tables = await stmt.all();
    results.steps.push({
      step: "3. Raw D1 Query (tables)",
      success: true,
      tables: tables.results?.map((t: any) => t.name) || [],
    });
  } catch (e: any) {
    results.steps.push({
      step: "3. Raw D1 Query (tables)",
      success: false,
      error: e.message,
    });
  }

  // Step 4: Prisma Client (EDGE VERSION - no fs.readdir error)
  try {
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaD1 } = await import("@prisma/adapter-d1");
    
    const adapter = new PrismaD1(d1Binding);
    const prisma = new PrismaClient({ adapter });
    
    const userCount = await prisma.user.count();
    results.steps.push({
      step: "4. Prisma Query (Edge)",
      success: true,
      userCount,
    });
  } catch (e: any) {
    results.steps.push({
      step: "4. Prisma Query (Edge)",
      success: false,
      error: e.message,
    });
  }

  // Step 5: Bcrypt
  try {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("test", 10);
    const valid = await bcrypt.compare("test", hash);
    results.steps.push({
      step: "5. Bcrypt Test",
      success: valid,
    });
  } catch (e: any) {
    results.steps.push({
      step: "5. Bcrypt Test",
      success: false,
      error: e.message,
    });
  }

  return NextResponse.json(results);
}
