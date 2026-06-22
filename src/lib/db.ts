import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getRequestContext } from '@opennextjs/cloudflare/next'

// Cache the Prisma client globally so it's reused across requests
// within the same Worker isolate (avoids creating a new client every request)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Get the Prisma client connected to Cloudflare D1.
 * Must be called inside a request context (API routes, server components, etc.)
 */
export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  // Get D1 binding from Cloudflare Workers request context
  const env = getRequestContext().env as { DB: D1Database }

  if (!env?.DB) {
    throw new Error(
      'D1 database binding "DB" not found.\n' +
        'Add a D1 binding named "DB" in:\n' +
        'Cloudflare Dashboard → Workers & Pages → cinezee → Settings → Bindings → Add → D1 database\n' +
        'Variable name must be: DB\n' +
        'D1 database: cinezee-db',
    )
  }

  // Create Prisma client with D1 adapter
  const adapter = new PrismaD1(env.DB)
  globalForPrisma.prisma = new PrismaClient({ adapter })
  return globalForPrisma.prisma
}

/**
 * Convenience export — works as a drop-in replacement for PrismaClient.
 * Uses a Proxy to lazily initialize the client on first access
 * (must be inside a request context).
 *
 * Usage:
 *   import { db } from '@/lib/db'
 *   const users = await db.user.findMany()
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb()
    const value = client[prop as keyof PrismaClient]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
