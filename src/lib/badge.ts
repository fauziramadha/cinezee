/**
 * src/lib/badge.ts
 * Badge management system (D1 backed)
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface Badge {
  id: number;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
}

export interface UserBadge extends Badge {
  equipped: boolean;
  assigned_at: string;
  expires_at: string | null;
}

export interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (!ctx?.env?.DB) throw new Error("D1 not available");
  return ctx.env.DB as D1Database;
}

// === ADMIN: List all badges ===
export async function getAllBadges(): Promise<Badge[]> {
  const d1 = await getD1();
  const result = await d1.prepare("SELECT * FROM badges ORDER BY id ASC").all<Badge>();
  return result.results || [];
}

// === ADMIN: Get User Info + Badges ===
export async function getUserInfoAndBadges(userId: string): Promise<{ user: UserInfo | null, badges: UserBadge[] }> {
  const d1 = await getD1();
  
  // 1. Get User Info
  const userResult = await d1
    .prepare("SELECT id, name, email, image FROM User WHERE id = ?")
    .bind(userId)
    .first<UserInfo>();
    
  if (!userResult) {
    return { user: null, badges: [] };
  }

  // 2. Cleanup expired badges
  await d1
    .prepare("DELETE FROM user_badges WHERE expires_at IS NOT NULL AND expires_at < datetime('now')")
    .run();

  // 3. Get Active Badges
  const badgesResult = await d1
    .prepare(
      `SELECT b.*, ub.equipped, ub.assigned_at, ub.expires_at 
       FROM user_badges ub 
       JOIN badges b ON ub.badge_id = b.id 
       WHERE ub.user_id = ? 
       ORDER BY ub.assigned_at DESC`
    )
    .bind(userId)
    .all<UserBadge>();

  return { user: userResult, badges: badgesResult.results || [] };
}

// === ADMIN: Assign badge to user ===export async function assignBadgeToUser(userId: string, badgeId: number, expiresAt?: string): Promise<void> {
  const d1 = await getD1();
  await d1
    .prepare(
      "INSERT OR IGNORE INTO user_badges (user_id, badge_id, expires_at) VALUES (?, ?, ?)"
    )
    .bind(userId, badgeId, expiresAt || null)
    .run();
}

// === ADMIN: Revoke badge from user ===
export async function revokeBadgeFromUser(userId: string, badgeId: number): Promise<void> {
  const d1 = await getD1();
  await d1
    .prepare("DELETE FROM user_badges WHERE user_id = ? AND badge_id = ?")
    .bind(userId, badgeId)
    .run();
}

// === USER: Get badges owned by a user (filtered by expiry) ===
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const d1 = await getD1();
  // Cleanup expired
  await d1
    .prepare("DELETE FROM user_badges WHERE expires_at IS NOT NULL AND expires_at < datetime('now')")
    .run();

  const result = await d1
    .prepare(
      `SELECT b.*, ub.equipped, ub.assigned_at, ub.expires_at 
       FROM user_badges ub 
       JOIN badges b ON ub.badge_id = b.id 
       WHERE ub.user_id = ? 
       ORDER BY ub.assigned_at DESC`
    )
    .bind(userId)
    .all<UserBadge>();
  return result.results || [];
}

// === USER: Equip a badge ===
export async function equipBadge(userId: string, badgeId: number): Promise<void> {
  const d1 = await getD1();
  await d1
    .prepare("UPDATE user_badges SET equipped = 0 WHERE user_id = ?")
    .bind(userId)
    .run();
  await d1
    .prepare("UPDATE user_badges SET equipped = 1 WHERE user_id = ? AND badge_id = ?")
    .bind(userId, badgeId)
    .run();
}

// === PUBLIC: Get equipped badge for a user (for comments) ===
export async function getEquippedBadge(userId: string): Promise<Badge | null> {
  const d1 = await getD1();
  // Cleanup expired first
  await d1
    .prepare("DELETE FROM user_badges WHERE expires_at IS NOT NULL AND expires_at < datetime('now')")
    .run();

  const result = await d1
    .prepare(
      `SELECT b.* FROM user_badges ub 
       JOIN badges b ON ub.badge_id = b.id 
       WHERE ub.user_id = ? AND ub.equipped = 1 
       LIMIT 1`
    )
    .bind(userId)
    .first<Badge>();
  return result || null;
}
