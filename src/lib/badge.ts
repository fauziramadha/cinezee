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

// === ADMIN: Assign badge to user ===
export async function assignBadgeToUser(userId: string, badgeId: number): Promise<void> {
  const d1 = await getD1();
  await d1
    .prepare("INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)")
    .bind(userId, badgeId)
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

// === USER: Get badges owned by a user ===
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const d1 = await getD1();
  const result = await d1
    .prepare(
      `SELECT b.*, ub.equipped, ub.assigned_at 
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
  // Unequip all others first
  await d1
    .prepare("UPDATE user_badges SET equipped = 0 WHERE user_id = ?")
    .bind(userId)
    .run();
  // Equip selected
  await d1
    .prepare("UPDATE user_badges SET equipped = 1 WHERE user_id = ? AND badge_id = ?")
    .bind(userId, badgeId)
    .run();
}

// === PUBLIC: Get equipped badge for a user (for comments) ===
export async function getEquippedBadge(userId: string): Promise<Badge | null> {
  const d1 = await getD1();
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
