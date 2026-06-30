import { getCloudflareContext } from "@opennextjs/cloudflare";

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

export interface AdBanner {
  id: number;
  name: string;
  image_url: string;
  click_url: string;
  position: string;
  is_active: number;
  impressions: number;
  clicks: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export const dbAd = {
  async listAll(): Promise<AdBanner[]> {
    const d1 = await getD1();
    const result = await d1
      .prepare("SELECT * FROM ad_banner ORDER BY created_at DESC")
      .all();
    return result.results || [];
  },

  async listActive(position?: string): Promise<AdBanner[]> {
    const d1 = await getD1();
    let query = `SELECT * FROM ad_banner WHERE is_active = 1 AND (start_date IS NULL OR start_date <= datetime('now')) AND (end_date IS NULL OR end_date >= datetime('now'))`;
    const params: string[] = [];
    
    if (position) {
      query += ` AND position = ?`;
      params.push(position);
    }
    
    query += ` ORDER BY impressions ASC LIMIT 5`;
    
    return d1.prepare(query).bind(...params).all().then(r => r.results || []);
  },

  async create(data: Omit<AdBanner, "id" | "impressions" | "clicks" | "created_at" | "updated_at">): Promise<number> {
    const d1 = await getD1();
    const result = await d1
      .prepare(
        `INSERT INTO ad_banner (name, image_url, click_url, position, is_active, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        data.name,
        data.image_url,
        data.click_url,
        data.position || "home_top",
        data.is_active ?? 1,
        data.start_date || null,
        data.end_date || null
      )
      .run();
    return (result.meta as any)?.last_row_id;
  },

  async update(id: number, data: Partial<AdBanner>): Promise<void> {
    const d1 = await getD1();
    const fields: string[] = [];
    const values: any[] = [];

    const allowed = ["name", "image_url", "click_url", "position", "is_active", "start_date", "end_date"];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) return;
    fields.push(`updated_at = datetime('now')`);
    values.push(id);

    await d1.prepare(`UPDATE ad_banner SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  },

  async delete(id: number): Promise<void> {
    const d1 = await getD1();
    await d1.prepare("DELETE FROM ad_banner WHERE id = ?").bind(id).run();
  },

  async incrementImpression(id: number): Promise<void> {
    const d1 = await getD1();
    await d1.prepare("UPDATE ad_banner SET impressions = impressions + 1 WHERE id = ?").bind(id).run();
  },

  async incrementClick(id: number): Promise<void> {
    const d1 = await getD1();
    await d1.prepare("UPDATE ad_banner SET clicks = clicks + 1 WHERE id = ?").bind(id).run();
  },
};
