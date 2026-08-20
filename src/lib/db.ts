import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Raw D1 Database Client
 * Bypasses Prisma engine entirely (fixes fs.readdir error on Workers).
 * Provides Prisma-like API using D1 native SQL.
 */

export interface User {
  id: string
  name: string | null
  email: string
  emailVerified: string | null
  image: string | null
  password: string | null
  role: string
  language: string
  banned: number | boolean
  createdAt: string
  updatedAt: string
}

export interface Account {
  id: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token: string | null
  access_token: string | null
  expires_at: number | null
  token_type: string | null
  scope: string | null
  id_token: string | null
  session_state: string | null
}

function generateId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}

async function getD1(): Promise<D1Database> {
  try {
    const ctx = await getCloudflareContext()
    if (ctx?.env?.DB) {
      return ctx.env.DB as D1Database
    }
  } catch (error) {
    console.error('getCloudflareContext error:', error)
  }
  throw new Error('D1 database binding "DB" not found.')
}

// =====================================================
// User operations
// =====================================================

export const db = {
  user: {
    async findUnique({ where }: { where: { id?: string; email?: string } }): Promise<User | null> {
      const d1 = await getD1()
      if (where.email) {
        const result = await d1.prepare('SELECT * FROM User WHERE email = ?').bind(where.email).first<User>()
        return result || null
      }
      if (where.id) {
        const result = await d1.prepare('SELECT * FROM User WHERE id = ?').bind(where.id).first<User>()
        return result || null
      }
      return null
    },

    async create({ data }: { data: Partial<User> }): Promise<User> {
      const d1 = await getD1()
      const id = data.id || generateId()
      const now = new Date().toISOString()
      await d1.prepare(
        'INSERT INTO User (id, name, email, emailVerified, image, password, role, language, banned, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id,
        data.name || null,
        data.email,
        data.emailVerified || null,
        data.image || null,
        data.password || null,
        data.role || 'user',
        data.language || 'en',
        data.banned ? 1 : 0,
        now,
        now
      ).run()
      return { ...data, id, createdAt: now, updatedAt: now } as User
    },

    async update({ where, data }: { where: { id?: string; email?: string }; data: Partial<User> }): Promise<User> {
      const d1 = await getD1()
      const now = new Date().toISOString()
      const sets: string[] = []
      const values: any[] = []
      
      for (const [key, value] of Object.entries(data)) {
        sets.push(`${key} = ?`)
        values.push(value)
      }
      sets.push('updatedAt = ?')
      values.push(now)
      
      if (where.id) {
        values.push(where.id)
        await d1.prepare(`UPDATE User SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run()
      } else if (where.email) {
        values.push(where.email)
        await d1.prepare(`UPDATE User SET ${sets.join(', ')} WHERE email = ?`).bind(...values).run()
      }
      
      // Return updated user
      if (where.id) return await this.findUnique({ where: { id: where.id } }) as User
      if (where.email) return await this.findUnique({ where: { email: where.email! } }) as User
      throw new Error('No where clause provided')
    },

    async delete({ where }: { where: { id: string } }): Promise<User | null> {
      const user = await this.findUnique({ where })
      if (!user) return null
      const d1 = await getD1()
      await d1.prepare('DELETE FROM User WHERE id = ?').bind(where.id).run()
      return user
    },

    async count(): Promise<number> {
      const d1 = await getD1()
      const result = await d1.prepare('SELECT COUNT(*) as count FROM User').first<{ count: number }>()
      return result?.count || 0
    },
  },

  // =====================================================
  // Account operations (for Google OAuth)
  // =====================================================

  account: {
    async findUnique({ where }: { where: { provider_providerAccountId: { provider: string; providerAccountId: string } } }): Promise<(Account & { user: User }) | null> {
      const d1 = await getD1()
      const { provider, providerAccountId } = where.provider_providerAccountId
      const result = await d1.prepare(
        'SELECT a.*, u.* FROM Account a JOIN User u ON a.userId = u.id WHERE a.provider = ? AND a.providerAccountId = ?'
      ).bind(provider, providerAccountId).first<any>()
      if (!result) return null
      // D1 returns flat object, split into account + user
      const user: User = {
        id: result.userId,
        name: result.name,
        email: result.email,
        emailVerified: result.emailVerified,
        image: result.image,
        password: result.password,
        role: result.role,
        language: result.language,
        banned: result.banned,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      }
      const account: Account = {
        id: result.id,
        userId: result.userId,
        type: result.type,
        provider: result.provider,
        providerAccountId: result.providerAccountId,
        refresh_token: result.refresh_token,
        access_token: result.access_token,
        expires_at: result.expires_at,
        token_type: result.token_type,
        scope: result.scope,
        id_token: result.id_token,
        session_state: result.session_state,
      }
      return { ...account, user }
    },

    async create({ data }: { data: Partial<Account> }): Promise<Account> {
      const d1 = await getD1()
      const id = data.id || generateId()
      await d1.prepare(
        'INSERT INTO Account (id, userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id,
        data.userId,
        data.type,
        data.provider,
        data.providerAccountId,
        data.refresh_token || null,
        data.access_token || null,
        data.expires_at || null,
        data.token_type || null,
        data.scope || null,
        data.id_token || null,
        data.session_state || null
      ).run()
      return { ...data, id } as Account
    },

    async delete({ where }: { where: { provider_providerAccountId: { provider: string; providerAccountId: string } } }): Promise<void> {
      const d1 = await getD1()
      const { provider, providerAccountId } = where.provider_providerAccountId
      await d1.prepare('DELETE FROM Account WHERE provider = ? AND providerAccountId = ?').bind(provider, providerAccountId).run()
    },
  },
}

/**
 * Get db client (kept for backward compatibility with auth.ts).
 */
export async function getDb() {
  return db
}
