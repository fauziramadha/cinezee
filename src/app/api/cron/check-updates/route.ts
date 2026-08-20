/**
 * src/app/api/cron/check-updates/route.ts
 *
 * GET /api/cron/check-updates?api_key=ADMIN_API_KEY
 *
 * Pakai cinemacity RSS feed (/rss.xml) buat detect:
 *   1. Film baru (yang belum ada di DB)
 *   2. Quality/server update (film lama yang baru update)
 *
 * RSS memberikan:
 *   - pubDate: timestamp update terbaru
 *   - quality: WEB-DL, CAM-Rip, TS, dll
 *   - badge: "New" / "Update" (langsung dari cinemacity)
 *
 * Lebih akurat daripada scrape homepage karena RSS include
 * semua update terbaru (termasuk film lama yang baru update quality).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sendTelegramMessage } from "@/lib/telegram";

const CINEMACITY_BASE = "https://cinemacity.cc";
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (!ctx?.env?.DB) throw new Error("D1 not available");
  return ctx.env.DB as D1Database;
}

function cookiesToHeader(cookies: any[]): string {
  return cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
}

// ============================================================
// RSS Item structure
// ============================================================
interface RssItem {
  title: string;
  slug: string;
  type: "movie" | "tv";
  pubDate: string;       // ISO timestamp
  quality: string | null;
  year: string | null;
  badge: string | null;  // "New", "Update", dll
  url: string;
}

// ============================================================
// Parse RSS XML → list of items
// ============================================================
function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch;

  while ((itemMatch = itemPattern.exec(xml)) !== null) {
    const itemXml = itemMatch[1];

    const getField = (tag: string): string | null => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i"));
      return m ? m[1].trim() : null;
    };

    const title = getField("title") || "Untitled";
    const link = getField("link") || getField("guid") || "";
    const pubDate = getField("pubDate") || "";
    const quality = getField("quality");
    const year = getField("year");
    const badge = getField("badge");

    // Extract slug & type dari URL
    // URL: https://cinemacity.cc/movies/1873-obsession.html
    // atau: https://cinemacity.cc/tv-series/1990-rick-and-morty.html
    const slugMatch = link.match(/\/(movies|tv-series)\/(\d+-[^\/]+?)\.html/);
    if (!slugMatch) continue;

    const type = slugMatch[1] === "movies" ? "movie" : "tv";
    const slug = slugMatch[2];

    items.push({
      title,
      slug,
      type,
      pubDate,
      quality,
      year,
      badge,
      url: link,
    });
  }

  return items;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Auth
  const url = new URL(request.url);
  const apiKey = url.searchParams.get("api_key");
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken =
    process.env.TELEGRAM_API_KEY || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || url.searchParams.get("chat_id");

  if (!botToken || !chatId) {
    return NextResponse.json(
      { error: "TELEGRAM_API_KEY or TELEGRAM_CHAT_ID not configured" },
      { status: 500 }
    );
  }

  const d1 = await getD1();

  // Get active cinemacity cookies
  const cookieRows = await d1
    .prepare(`SELECT cookies_json FROM cinemacity_cookies WHERE is_active = 1 LIMIT 1`)
    .all<{ cookies_json: string }>();
  if (!cookieRows.results[0]) {
    return NextResponse.json(
      { error: "No active cinemacity cookies" },
      { status: 503 }
    );
  }
  const cookies = JSON.parse(cookieRows.results[0].cookies_json);

  // ============================================================
  // Fetch RSS feed (1 request, ~1 detik)
  // ============================================================
  let rssXml: string;
  try {
    const res = await fetch(`${CINEMACITY_BASE}/rss.xml`, {
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "application/xml,text/xml,*/*",
        "Cookie": cookiesToHeader(cookies),
        "Referer": CINEMACITY_BASE + "/",
      },
    });
    rssXml = await res.text();
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch RSS" },
      { status: 502 }
    );
  }

  // Parse RSS
  const rssItems = parseRssXml(rssXml);
  console.log(`[Cron] RSS items: ${rssItems.length}`);

  // Get previously stored films
  const stored = await d1
    .prepare(`SELECT slug, title, type, quality, last_pubdate FROM cinemacity_film_updates`)
    .all<{
      slug: string;
      title: string;
      type: string;
      quality: string | null;
      last_pubdate: string | null;
    }>();
  const storedMap = new Map<
    string,
    { title: string; type: string; quality: string | null; lastPubDate: string | null }
  >();
  for (const row of stored.results) {
    storedMap.set(row.slug, {
      title: row.title,
      type: row.type,
      quality: row.quality,
      lastPubDate: row.last_pubdate,
    });
  }

  const newFilms: RssItem[] = [];
  const updatedFilms: Array<{
    item: RssItem;
    oldQuality: string | null;
    newQuality: string | null;
  }> = [];

  // ============================================================
  // Check setiap RSS item
  // ============================================================
  for (const item of rssItems) {
    const stored = storedMap.get(item.slug);

    if (!stored) {
      // Film baru (belum ada di DB)
      newFilms.push(item);
      await d1
        .prepare(
          `INSERT OR IGNORE INTO cinemacity_film_updates
            (slug, title, type, quality, last_pubdate, first_seen, last_checked)
           VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(item.slug, item.title, item.type, item.quality, item.pubDate)
        .run();
    } else {
      // Film lama — cek apakah ada update (quality berubah atau pubDate lebih baru)
      const qualityChanged =
        item.quality && stored.quality && item.quality !== stored.quality;
      const pubDateChanged =
        item.pubDate && stored.lastPubDate && item.pubDate !== stored.lastPubDate;

      if (qualityChanged || pubDateChanged) {
        updatedFilms.push({
          item,
          oldQuality: stored.quality,
          newQuality: item.quality,
        });

        // Update DB
        await d1
          .prepare(
            `UPDATE cinemacity_film_updates
             SET quality = ?, last_pubdate = ?, last_checked = datetime('now')
             WHERE slug = ?`
          )
          .bind(item.quality, item.pubDate, item.slug)
          .run();
      } else {
        // Cuma update last_checked
        await d1
          .prepare(
            `UPDATE cinemacity_film_updates SET last_checked = datetime('now') WHERE slug = ?`
          )
          .bind(item.slug)
          .run();
      }
    }
  }

  // ============================================================
  // Send Telegram notifications
  // ============================================================
  let notificationsSent = 0;

  // Notif 1: Film baru
  if (newFilms.length > 0) {
    let msg = `🎬 <b>${newFilms.length} Film Baru di Cinemacity</b>\n\n`;
    for (const film of newFilms.slice(0, 10)) {
      msg += `• <b>${film.title}</b> (${film.type === "tv" ? "TV" : "Movie"}`;
      if (film.year) msg += ` ${film.year}`;
      msg += `)\n`;
      if (film.quality) msg += `  📦 ${film.quality}\n`;
      msg += `  ${film.url}\n`;
    }
    if (newFilms.length > 10) msg += `\n... dan ${newFilms.length - 10} lainnya`;
    msg += `\n\n📢 Siap-siap upload subtitle Indonesia!`;
    await sendTelegramMessage(botToken, chatId, msg);
    notificationsSent++;
  }

  // Notif 2: Quality update (film lama yang baru update)
  if (updatedFilms.length > 0) {
    let msg = `🔄 <b>${updatedFilms.length} Film Update Quality</b>\n\n`;
    for (const film of updatedFilms.slice(0, 5)) {
      msg += `• <b>${film.item.title}</b>\n`;
      if (film.oldQuality && film.newQuality && film.oldQuality !== film.newQuality) {
        msg += `  📦 Quality: <s>${film.oldQuality}</s> → <b>${film.newQuality}</b>\n`;
      } else if (film.newQuality) {
        msg += `  📦 Quality: <b>${film.newQuality}</b>\n`;
      }
      if (film.item.badge) msg += `  🏷 Badge: ${film.item.badge}\n`;
      msg += `  ${film.item.url}\n\n`;
    }
    msg += `📢 Cek subtitle Indonesia untuk quality baru!`;
    await sendTelegramMessage(botToken, chatId, msg);
    notificationsSent++;
  }

  // Notif 3: No update (debug info, optional)
  if (notificationsSent === 0) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `✅ Cron check selesai. Tidak ada update baru.\n\n📊 RSS items: ${rssItems.length}\n⏱ Duration: ${Date.now() - startTime}ms`
    );
  }

  const duration = Date.now() - startTime;

  return NextResponse.json({
    success: true,
    rssItemsTotal: rssItems.length,
    newFilms: newFilms.length,
    newFilmsList: newFilms.map((f) => f.title),
    updatedFilms: updatedFilms.length,
    updatedFilmsList: updatedFilms.map((f) => ({
      title: f.item.title,
      oldQuality: f.oldQuality,
      newQuality: f.newQuality,
    })),
    notificationsSent,
    durationMs: duration,
    checkedAt: new Date().toISOString(),
  });
}
