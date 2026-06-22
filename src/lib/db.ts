import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

// Cache the Prisma client globally so it's reused across requests
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Get D1 binding from Cloudflare Workers environment.
 * Supports multiple @opennextjs/cloudflare versions.
 */
function getD1Binding(): D1Database {
  // Try different ways to access D1 binding
  // 1. Via getCloudflareContext (newer versions)
  try {
    const mod = require('@opennextjs/cloudflare/next')
    if (mod.getCloudflareContext) {
      const ctx = mod.getCloudflareContext()
      if (ctx?.env?.DB) return ctx.env.DB
    }
    if (mod.getRequestContext) {
      const ctx = mod.getRequestContext()
      if (ctx?.env?.DB) return ctx.env.DB
    }
  } catch {}

  // 2. Via globalThis (fallback)
  const globalEnv = (globalThis as any).cf?.env ?? (globalThis as any).env
  if (globalEnv?.DB) return globalEnv.DB

  // 3. Via process.env (some setups)
  if (typeof process !== 'undefined' && (process as any).env?.DB) {
    return (process as any).env.DB
  }

  throw new Error(
    'D1 database binding "DB" not found.\n' +
    'Make sure D1 binding is set in wrangler.toml or Cloudflare Dashboard.'
  )
}

/**
 * Get the Prisma client connected to Cloudflare D1.
 * Must be called inside a request context.
 */
export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  const d1 = getD1Binding()
  const adapter = new PrismaD1(d1)
  globalForPrisma.prisma = new PrismaClient({ adapter })
  return globalForPrisma.prisma
}

/**
 * Convenience export — works as a drop-in replacement for PrismaClient.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb()
    const value = client[prop as keyof PrismaClient]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
