/**
 * src/app/api/cron/check-updates/route.ts
 *
 * GET /api/cron/check-updates?api_key=ADMIN_API_KEY
 *
 * Check cinemacity untuk film baru & quality update.
 * Kirim notifikasi Telegram kalau ada perubahan.
 *
 * Setup external cron (cron-job.org, GitHub Actions) untuk hit endpoint ini tiap 6 jam.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sendTelegramMessage } from "@/lib/telegram";

const CINEMACITY_BASE = "https://cinemacity.cc";
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface FilmUpdate {
  slug: string;
  title: string;
  type: string;
  servers_json: string | null;
  first_seen: string;
  last_checked: string;
}

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (!ctx?.env?.DB) throw new Error("D1 not available");
  return ctx.env.DB as D1Database;
}

function cookiesToHeader(cookies: any[]): string {
  return cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
}

export async function GET(request: NextRequest) {
  // Auth: API key (untuk external cron)
  const url = new URL(request.url);
  const apiKey = url.searchParams.get("api_key");
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_API_KEY || process.env.TELEGRAM_BOT_TOKEN;
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
    return NextResponse.json({ error: "No active cinemacity cookies" }, { status: 503 });
  }
  const cookies = JSON.parse(cookieRows.results[0].cookies_json);

  // Fetch cinemacity homepage
  let homeHtml: string;
  try {
    const res = await fetch(`${CINEMACITY_BASE}/`, {
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "text/html,*/*",
        "Cookie": cookiesToHeader(cookies),
        "Referer": CINEMACITY_BASE + "/",
      },
    });
    homeHtml = await res.text();
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch cinemacity" }, { status: 502 });
  }

  // Parse film list (slug, title, type)
  const linkPattern = /href="(?:https?:\/\/cinemacity\.cc)?\/(movies|tv-series)\/(\d+)-([^"\/]+?)\.html"/g;
  const imgPattern = /<img[^>]*class="[^"]*xfieldimage[^"]*"[^>]*src="([^"]+)"/gi;

  const images: Array<{ pos: number; src: string }> = [];
  let imgMatch;
  while ((imgMatch = imgPattern.exec(homeHtml)) !== null) {
    images.push({ pos: imgMatch.index, src: imgMatch[1] });
  }

  const seen = new Set<string>();
  const currentFilms: Array<{ slug: string; title: string; type: string }> = [];
  let match;
  while ((match = linkPattern.exec(homeHtml)) !== null) {
    const slug = `${match[2]}-${match[3]}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    let title = match[3].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const afterMatch = homeHtml.slice(match.index!).match(/^[^>]*>([^<]+)</);
    if (afterMatch && afterMatch[1]) title = afterMatch[1].trim();
    title = title.replace(/\s*\(\d{4}.*?\)\s*$/, "").trim();

    currentFilms.push({
      slug,
      title,
      type: match[1] === "movies" ? "movie" : "tv",
    });
  }

  // Get previously stored films
  const stored = await d1.prepare(`SELECT * FROM cinemacity_film_updates`).all<FilmUpdate>();
  const storedMap = new Map<string, FilmUpdate>();
  for (const row of stored.results) {
    storedMap.set(row.slug, row);
  }

  const newFilms: typeof currentFilms = [];
  const updatedFilms: Array<{ slug: string; title: string; oldServers: string[]; newServers: string[] }> = [];

  // Check top 15 films for server updates (limit to avoid rate limit)
  const topFilmsToCheck = currentFilms.slice(0, 15);

  for (const film of topFilmsToCheck) {
    const storedFilm = storedMap.get(film.slug);

    // Fetch detail page untuk dapet servers
    let newServers: string[] = [];
    try {
      const detailRes = await fetch(`${CINEMACITY_BASE}/${film.type === "movie" ? "movies" : "tv-series"}/${film.slug}.html`, {
        headers: {
          "User-Agent": DEFAULT_UA,
          "Accept": "text/html,*/*",
          "Cookie": cookiesToHeader(cookies),
          "Referer": CINEMACITY_BASE + "/",
        },
      });
      if (detailRes.ok) {
        const detailHtml = await detailRes.text();
        // Search for Playerjs file titles (server names)
        const atobPattern = /atob\("([^"]+)"\)/g;
        const atobMatches = [...detailHtml.matchAll(atobPattern)];
        for (const m of atobMatches) {
          try {
            const decoded = atob(m[1]);
            const fileMatch = decoded.match(/new\s+Playerjs\s*\(\s*\{[\s\S]*?file\s*:\s*'(\[[\s\S]*?\])'/);
            if (fileMatch) {
              const fileArray = JSON.parse(fileMatch[1].replace(/\\\//g, "/"));
              for (const src of fileArray) {
                if (src.title) newServers.push(src.title);
              }
            }
          } catch {}
        }
      }
    } catch {}

    if (!storedFilm) {
      // New film
      newFilms.push(film);
      await d1
        .prepare(
          `INSERT INTO cinemacity_film_updates (slug, title, type, servers_json, first_seen, last_checked)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(film.slug, film.title, film.type, JSON.stringify(newServers))
        .run();
    } else {
      // Existing film — check server changes
      const oldServers: string[] = storedFilm.servers_json
        ? JSON.parse(storedFilm.servers_json)
        : [];
      const oldSet = new Set(oldServers);
      const newSet = new Set(newServers);
      const hasChange =
        newServers.length > 0 &&
        (newServers.length !== oldServers.length ||
          newServers.some((s) => !oldSet.has(s)));

      if (hasChange) {
        const added = newServers.filter((s) => !oldSet.has(s));
        updatedFilms.push({
          slug: film.slug,
          title: film.title,
          oldServers,
          newServers,
        });
      }

      await d1
        .prepare(
          `UPDATE cinemacity_film_updates SET servers_json = ?, last_checked = datetime('now') WHERE slug = ?`
        )
        .bind(JSON.stringify(newServers), film.slug)
        .run();
    }

    // Delay 2 detik antara film untuk avoid rate limit
    await new Promise((r) => setTimeout(r, 2000));
  }

  // ============================================================
  // Send Telegram notifications
  // ============================================================
  let notificationsSent = 0;

  if (newFilms.length > 0) {
    let msg = `🎬 <b>${newFilms.length} Film Baru di Cinemacity</b>\n\n`;
    for (const film of newFilms.slice(0, 10)) {
      msg += `• <b>${film.title}</b> (${film.type === "tv" ? "TV" : "Movie"})\n`;
      msg += `  ${CINEMACITY_BASE}/${film.type === "movie" ? "movies" : "tv-series"}/${film.slug}.html\n`;
    }
    if (newFilms.length > 10) msg += `\n... dan ${newFilms.length - 10} lainnya`;
    msg += `\n\n📢 Siap-siap upload subtitle Indonesia!`;
    await sendTelegramMessage(botToken, chatId, msg);
    notificationsSent++;
  }

  if (updatedFilms.length > 0) {
    let msg = `🔄 <b>${updatedFilms.length} Film Update Quality</b>\n\n`;
    for (const film of updatedFilms.slice(0, 5)) {
      msg += `• <b>${film.title}</b>\n`;
      const added = film.newServers.filter((s) => !film.oldServers.includes(s));
      if (added.length > 0) {
        msg += `  Server baru: ${added.join(", ")}\n`;
      }
      msg += `  ${CINEMACITY_BASE}/movies/${film.slug}.html\n\n`;
    }
    msg += `📢 Cek subtitle Indonesia untuk server baru!`;
    await sendTelegramMessage(botToken, chatId, msg);
    notificationsSent++;
  }

  if (notificationsSent === 0) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `✅ Cron check selesai. Tidak ada update baru.\nFilm diperiksa: ${topFilmsToCheck.length}`
    );
  }

  return NextResponse.json({
    success: true,
    newFilms: newFilms.length,
    updatedFilms: updatedFilms.length,
    notificationsSent,
    checkedAt: new Date().toISOString(),
  });
}
