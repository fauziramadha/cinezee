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

  // Step 2: Coba akses D1 binding dengan berbagai cara
  let d1Binding: D1Database | null = null;
  const bindingMethods: string[] = [];

  // Method A: getCloudflareContext (async, versi baru)
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

  // Method B: getRequestContext (sync, versi lama)
  try {
    const mod = require("@opennextjs/cloudflare/next");
    if (mod.getRequestContext) {
      bindingMethods.push("getRequestContext found");
      const ctx = mod.getRequestContext();
      if (ctx?.env?.DB) {
        d1Binding = ctx.env.DB;
        bindingMethods.push("getRequestContext: DB found!");
      } else {
        bindingMethods.push("getRequestContext: DB NOT found in env");
      }
    } else {
      bindingMethods.push("getRequestContext NOT exported");
    }
  } catch (e: any) {
    bindingMethods.push(`getRequestContext error: ${e.message}`);
  }

  // Method C: globalThis fallback
  try {
    const globalEnv = (globalThis as any).cf?.env ?? (globalThis as any).env;
    if (globalEnv?.DB) {
      d1Binding = globalEnv.DB;
      bindingMethods.push("globalThis: DB found!");
    } else {
      bindingMethods.push("globalThis: DB NOT found");
    }
  } catch (e: any) {
    bindingMethods.push(`globalThis error: ${e.message}`);
  }

  results.steps.push({
    step: "2. D1 Binding Methods",
    methods: bindingMethods,
    d1Found: !!d1Binding,
  });

  // Kalau D1 tidak ketemu, stop di sini
  if (!d1Binding) {
    return NextResponse.json({
      ...results,
      error: "D1 binding NOT FOUND. Check wrangler.toml and Cloudflare Dashboard bindings.",
    });
  }

  // Step 3: Coba raw SQL query ke D1 (tanpa Prisma)
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

  // Step 4: Coba akses Prisma Client
  try {
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaD1 } = await import("@prisma/adapter-d1");
    
    const adapter = new PrismaD1(d1Binding);
    const prisma = new PrismaClient({ adapter });
    
    // Coba query user count
    const userCount = await prisma.user.count();
    results.steps.push({
      step: "4. Prisma Query",
      success: true,
      userCount,
    });
  } catch (e: any) {
    results.steps.push({
      step: "4. Prisma Query",
      success: false,
      error: e.message,
      stack: e.stack?.split("\n").slice(0, 5),
    });
  }

  // Step 5: Coba bcrypt
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
