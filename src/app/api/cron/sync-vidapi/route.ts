import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch { return null; }
}

async function getKV() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.VIDAPI_KV || null;
  } catch { return null; }
}

async function sendTelegramNotification(message: string) {
  const botToken = process.env.TELEGRAM_API_KEY;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
  } catch (e) { console.warn("[Telegram] Send error:", e); }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && querySecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDB();
  const kv = await getKV();
  if (!db || !kv) return NextResponse.json({ error: "DB or KV not connected" }, { status: 500 });

  try {
    console.log("[Cron] Mulai sinkronisasi VidAPI...");
    let moviesCount = 0, tvCount = 0, episodesCount = 0, showsCount = 0;

    // 1. Sync Movies Raw Text ke D1
    const movRes = await fetch("https://vidapi.ru/ids/movie_list_tmdb.txt", { headers: { "User-Agent": UA } });
    if (movRes.ok) {
      const text = "\n" + await movRes.text() + "\n";
      moviesCount = text.split("\n").length - 2;
      await db.prepare("INSERT OR REPLACE INTO vidapi_sync_data (key, value, updated_at) VALUES (?, ?, ?)")
        .bind("movie_ids_raw", text, Date.now()).run();
    }

    // 2. Sync TV Raw Text ke D1
    const tvRes = await fetch("https://vidapi.ru/ids/tv_list_tmdb.txt", { headers: { "User-Agent": UA } });
    if (tvRes.ok) {
      const text = "\n" + await tvRes.text() + "\n";
      tvCount = text.split("\n").length - 2;
      await db.prepare("INSERT OR REPLACE INTO vidapi_sync_data (key, value, updated_at) VALUES (?, ?, ?)")
        .bind("tv_ids_raw", text, Date.now()).run();
    }

    // 3. Sync Episodes (7MB) ke KV (Dipecah per IMDB ID)
    const epsRes = await fetch("https://vidapi.ru/ids/eps_list_imdb.txt", { headers: { "User-Agent": UA } });
    if (epsRes.ok) {
      const text = await epsRes.text();
      const lines = text.split("\n");
      episodesCount = lines.length;

      const showsMap = new Map<string, Map<number, number[]>>();

      for (const line of lines) {
        const trimLine = line.trim();
        if (!trimLine) continue;
        const idx = trimLine.indexOf("_");
        if (idx === -1) continue;

        const imdbId = trimLine.substring(0, idx);
        const parts = trimLine.substring(idx + 1).split("x");
        if (parts.length === 2) {
          const season = parseInt(parts[0], 10);
          const episode = parseInt(parts[1], 10);
          if (!isNaN(season) && !isNaN(episode)) {
            if (!showsMap.has(imdbId)) showsMap.set(imdbId, new Map());
            const seasonMap = showsMap.get(imdbId)!;
            if (!seasonMap.has(season)) seasonMap.set(season, []);
            seasonMap.get(season)!.push(episode);
          }
        }
      }

      showsCount = showsMap.size;
      console.log(`[Cron] Parsed ${showsCount} shows. Saving to KV...`);

      // Simpan per IMDB ID ke KV
      let savedCount = 0;
      for (const [imdbId, seasonMap] of showsMap) {
        const seasonsArray = Array.from(seasonMap.entries()).map(([season, episodes]) => ({
          season,
          episodes: episodes.sort((a, b) => a - b),
        }));
        await kv.put(`eps_${imdbId}`, JSON.stringify(seasonsArray), { expirationTtl: 86400 });
        savedCount++;
        if (savedCount % 1000 === 0) console.log(`[Cron] Saved ${savedCount}/${showsCount} to KV...`);
      }
      console.log(`[Cron] Finished saving episodes to KV.`);
    }

    // 4. Kirim Notifikasi Telegram
    const message = `🎬 <b>VidAPI Sync Completed</b>\n\n` +
      `📅 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n\n` +
      `🎥 Movies: <b>${moviesCount.toLocaleString()}</b>\n` +
      `📺 TV Shows: <b>${tvCount.toLocaleString()}</b>\n` +
      `🎬 Episodes: <b>${episodesCount.toLocaleString()}</b>\n` +
      `🎭 Shows Parsed: <b>${showsCount.toLocaleString()}</b>\n\n` +
      `✅ Data tersimpan (D1 + KV Split).`;
    
    await sendTelegramNotification(message);

    return NextResponse.json({ success: true, moviesCount, tvCount, episodesCount, showsCount });

  } catch (err: any) {
    console.error("[Cron] Error:", err);
    await sendTelegramNotification(`❌ <b>VidAPI Sync Failed</b>\n\nError: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
