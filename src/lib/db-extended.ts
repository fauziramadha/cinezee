/**
 * src/lib/db-extended.ts
 *
 * Extension module for provider_config & admin_message tables.
 * Self-contained — uses getCloudflareContext() directly, does NOT
 * import from src/lib/db.ts (to avoid coupling with Prisma-like API).
 *
 * Import cara pakai:
 *   import { dbProvider, dbMessage } from "@/lib/db-extended";
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

// ============================================================
// D1 DATABASE ACCESS
// ============================================================
async function getD1(): Promise<D1Database> {
  try {
    const ctx = await getCloudflareContext();
    if (ctx?.env?.DB) {
      return ctx.env.DB as D1Database;
    }
  } catch (error) {
    console.error("getCloudflareContext error:", error);
  }
  throw new Error('D1 database binding "DB" not found.');
}

type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  meta?: unknown;
};

// Helper: jalankan SELECT query, return array of rows
async function query<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const d1 = await getD1();
  const stmt = d1.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result: D1Result<T> = await bound.all();
  return result.results || [];
}

// Helper: jalankan INSERT/UPDATE/DELETE
async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ lastInsertRowid?: number }> {
  const d1 = await getD1();
  const stmt = d1.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.run();
  const lastInsertRowid = (result.meta as any)?.last_row_id;
  return { lastInsertRowid };
}

// Helper: jalankan INSERT dan return last_insert_rowid
async function insertAndGetId(
  sql: string,
  params: unknown[]
): Promise<number> {
  const { lastInsertRowid } = await execute(sql, params);
  if (!lastInsertRowid) {
    throw new Error("Failed to get insert ID");
  }
  return lastInsertRowid;
}

// ============================================================
// PROVIDER CONFIG OPERATIONS
// ============================================================
export interface ProviderConfig {
  id: number;
  name: string;
  server_label: string;
  embed_base: string;
  movie_path: string;
  tv_path: string;
  brutality: number;
  is_active: number;
  sort_order: number;
  api_key: string | null;
  api_key_param: string | null;
  debug_param: string | null;
  created_at: string;
  updated_at: string;
}

export const dbProvider = {
  async listAll(includeInactive = false): Promise<ProviderConfig[]> {
    const where = includeInactive ? "" : "WHERE is_active = 1";
    return query<ProviderConfig>(
      `SELECT * FROM provider_config ${where} ORDER BY sort_order ASC, id ASC`,
      []
    );
  },

  async listActive(): Promise<ProviderConfig[]> {
    return query<ProviderConfig>(
      "SELECT * FROM provider_config WHERE is_active = 1 ORDER BY sort_order ASC, id ASC"
    );
  },

  async getById(id: number): Promise<ProviderConfig | null> {
    const rows = await query<ProviderConfig>(
      "SELECT * FROM provider_config WHERE id = ? LIMIT 1",
      [id]
    );
    return rows[0] || null;
  },

  async create(
    data: Omit<ProviderConfig, "id" | "created_at" | "updated_at">
  ): Promise<number> {
    return insertAndGetId(
      `INSERT INTO provider_config
        (name, server_label, embed_base, movie_path, tv_path, brutality, is_active, sort_order, api_key, api_key_param, debug_param)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.server_label,
        data.embed_base,
        data.movie_path,
        data.tv_path,
        data.brutality ?? 0,
        data.is_active ?? 1,
        data.sort_order ?? 0,
        data.api_key,
        data.api_key_param,
        data.debug_param,
      ]
    );
  },

  async update(
    id: number,
    data: Partial<Omit<ProviderConfig, "id" | "created_at" | "updated_at">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowed = [
      "name",
      "server_label",
      "embed_base",
      "movie_path",
      "tv_path",
      "brutality",
      "is_active",
      "sort_order",
      "api_key",
      "api_key_param",
      "debug_param",
    ];

    for (const key of allowed) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push((data as any)[key]);
      }
    }

    if (fields.length === 0) return;

    fields.push(`updated_at = datetime('now')`);
    values.push(id);

    await execute(
      `UPDATE provider_config SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
  },

  async delete(id: number): Promise<void> {
    await execute("DELETE FROM provider_config WHERE id = ?", [id]);
  },

  async toggleActive(id: number, isActive: boolean): Promise<void> {
    await execute(
      "UPDATE provider_config SET is_active = ?, updated_at = datetime('now') WHERE id = ?",
      [isActive ? 1 : 0, id]
    );
  },

  async reorder(orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await execute(
        "UPDATE provider_config SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
        [i + 1, orderedIds[i]]
      );
    }
  },
};

// ============================================================
// ADMIN MESSAGE OPERATIONS
// ============================================================
export interface AdminMessage {
  id: number;
  sender_id: string;
  sender_name: string | null;
  recipient_id: string | null;
  recipient_name: string | null;
  subject: string | null;
  body: string;
  type: "info" | "warning" | "announcement" | "system";
  is_pinned: number;
  created_at: string;
  expires_at: string | null;
  deleted_at: string | null;
}

export interface AdminMessageWithMeta extends AdminMessage {
  is_read?: boolean;
  read_at?: string | null;
  recipient_count?: number;
  read_count?: number;
}

export const dbMessage = {
  async listAll(limit = 100): Promise<AdminMessageWithMeta[]> {
    return query<AdminMessageWithMeta>(
      `SELECT m.*,
        (SELECT COUNT(*) FROM admin_message_read r WHERE r.message_id = m.id) as read_count
       FROM admin_message m
       WHERE m.deleted_at IS NULL
       ORDER BY m.is_pinned DESC, m.created_at DESC
       LIMIT ?`,
      [limit]
    );
  },

  async send(data: {
    senderId: string;
    senderName?: string | null;
    recipientId?: string | null;
    recipientName?: string | null;
    subject?: string | null;
    body: string;
    type?: AdminMessage["type"];
    isPinned?: boolean;
    expiresAt?: string | null;
  }): Promise<number> {
    return insertAndGetId(
      `INSERT INTO admin_message
        (sender_id, sender_name, recipient_id, recipient_name, subject, body, type, is_pinned, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.senderId,
        data.senderName || null,
        data.recipientId || null,
        data.recipientName || null,
        data.subject || null,
        data.body,
        data.type || "info",
        data.isPinned ? 1 : 0,
        data.expiresAt || null,
      ]
    );
  },

  async delete(messageId: number): Promise<void> {
    await execute(
      "UPDATE admin_message SET deleted_at = datetime('now') WHERE id = ?",
      [messageId]
    );
  },

  async setPinned(messageId: number, pinned: boolean): Promise<void> {
    await execute(
      "UPDATE admin_message SET is_pinned = ? WHERE id = ?",
      [pinned ? 1 : 0, messageId]
    );
  },

  async getStats(messageId: number): Promise<{
    recipientCount: number;
    readCount: number;
  }> {
    const msg = await query<AdminMessage>(
      "SELECT * FROM admin_message WHERE id = ? LIMIT 1",
      [messageId]
    );
    if (!msg[0]) return { recipientCount: 0, readCount: 0 };

    let recipientCount = 0;
    if (msg[0].recipient_id === null) {
      // Broadcast: count all users (tabel User, capital U — sesuai db.ts kamu)
      const countRows = await query<{ total: number }>(
        "SELECT COUNT(*) as total FROM User"
      );
      recipientCount = countRows[0]?.total || 0;
    } else {
      recipientCount = 1;
    }

    const readRows = await query<{ total: number }>(
      "SELECT COUNT(*) as total FROM admin_message_read WHERE message_id = ?",
      [messageId]
    );
    const readCount = readRows[0]?.total || 0;

    return { recipientCount, readCount };
  },

  async listForUser(
    userId: string,
    limit = 50
  ): Promise<AdminMessageWithMeta[]> {
    return query<AdminMessageWithMeta>(
      `SELECT m.*,
        CASE WHEN r.read_at IS NOT NULL THEN 1 ELSE 0 END as is_read,
        r.read_at
       FROM admin_message m
       LEFT JOIN admin_message_read r
         ON r.message_id = m.id AND r.user_id = ?
       WHERE m.deleted_at IS NULL
         AND (m.recipient_id IS NULL OR m.recipient_id = ?)
         AND (m.expires_at IS NULL OR m.expires_at > datetime('now'))
       ORDER BY m.is_pinned DESC, m.created_at DESC
       LIMIT ?`,
      [userId, userId, limit]
    );
  },

  async countUnread(userId: string): Promise<number> {
    const rows = await query<{ total: number }>(
      `SELECT COUNT(*) as total
       FROM admin_message m
       LEFT JOIN admin_message_read r
         ON r.message_id = m.id AND r.user_id = ?
       WHERE m.deleted_at IS NULL
         AND r.read_at IS NULL
         AND (m.recipient_id IS NULL OR m.recipient_id = ?)
         AND (m.expires_at IS NULL OR m.expires_at > datetime('now'))`,
      [userId, userId]
    );
    return rows[0]?.total || 0;
  },

  async markAsRead(messageId: number, userId: string): Promise<void> {
    await execute(
      `INSERT OR IGNORE INTO admin_message_read (message_id, user_id, read_at)
       VALUES (?, ?, datetime('now'))`,
      [messageId, userId]
    );
  },

  async markAllAsRead(userId: string): Promise<void> {
    const unread = await query<{ id: number }>(
      `SELECT m.id
       FROM admin_message m
       LEFT JOIN admin_message_read r
         ON r.message_id = m.id AND r.user_id = ?
       WHERE m.deleted_at IS NULL
         AND r.read_at IS NULL
         AND (m.recipient_id IS NULL OR m.recipient_id = ?)`,
      [userId, userId]
    );
    for (const msg of unread) {
      await execute(
        `INSERT OR IGNORE INTO admin_message_read (message_id, user_id, read_at)
         VALUES (?, ?, datetime('now'))`,
        [msg.id, userId]
      );
    }
  },

  async listUsers(limit = 200): Promise<
    Array<{
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    }>
  > {
    // Tabel User, capital U — sesuai db.ts kamu
    return query(
      `SELECT id, name, email, image FROM User ORDER BY name ASC LIMIT ?`,
      [limit]
    );
  },
};
