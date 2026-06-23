import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// Cache the Prisma client globally so it's reused across requests
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Get D1 binding from Cloudflare Workers environment.
 * Uses the official async getCloudflareContext from OpenNext.
 */
async function getD1Binding(): Promise<D1Database> {
  try {
    const ctx = await getCloudflareContext()
    if (ctx?.env?.DB) {
      return ctx.env.DB as D1Database
    }
  } catch (error) {
    console.error('getCloudflareContext error:', error)
  }

  throw new Error(
    'D1 database binding "DB" not found.\n' +
    'Make sure D1 binding is set in wrangler.toml or Cloudflare Dashboard.'
  )
}

/**
 * Get the Prisma client connected to Cloudflare D1.
 * Uses driverAdapters (configured in schema.prisma) which auto-detects edge runtime.
 *
 * IMPORTANT: This is an ASYNC function. Always use `await getDb()`.
 */
export async function getDb(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  const d1 = await getD1Binding()
  const adapter = new PrismaD1(d1)
  globalForPrisma.prisma = new PrismaClient({ adapter })
  return globalForPrisma.prisma
}
