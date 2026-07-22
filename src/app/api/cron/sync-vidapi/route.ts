import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
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
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (e) {
    console.warn("[Telegram] Send error:", e);
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && querySecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDB();
  if (!db) {
    return NextResponse.json({ error: "DB not connected" }, { status: 500 });
  }

  try {
    console.log("[Cron] Mulai sinkronisasi VidAPI...");
    let moviesCount = 0, tvCount = 0, episodesCount = 0;

    // 1. Sync Movies (TMDB IDs)
    const movRes = await fetch("https://vidapi.ru/ids/movie_list_tmdb.txt", { headers: { "User-Agent": UA } });
    if (movRes.ok) {
      const text = await movRes.text();
      const ids = text.split("\n").map(s => s.trim()).filter(Boolean);
      moviesCount = ids.length;
      await db.prepare("INSERT OR REPLACE INTO vidapi_sync_data (key, value, updated_at) VALUES (?, ?, ?)")
        .bind("movie_ids", JSON.stringify(ids), Date.now()).run();
      console.log(`[Cron] Movies synced: ${moviesCount}`);
    }

    // 2. Sync TV (TMDB IDs)
    const tvRes = await fetch("https://vidapi.ru/ids/tv_list_tmdb.txt", { headers: { "User-Agent": UA } });
    if (tvRes.ok) {
      const text = await tvRes.text();
      const ids = text.split("\n").map(s => s.trim()).filter(Boolean);
      tvCount = ids.length;
      await db.prepare("INSERT OR REPLACE INTO vidapi_sync_data (key, value, updated_at) VALUES (?, ?, ?)")
        .bind("tv_ids", JSON.stringify(ids), Date.now()).run();
      console.log(`[Cron] TV synced: ${tvCount}`);
    }

    // 3. Sync Episodes (Simpan raw text ke D1, TIDAK DIPARSE di sini agar tidak CPU limit)
    const epsRes = await fetch("https://vidapi.ru/ids/eps_list_imdb.txt", { headers: { "User-Agent": UA } });
    if (epsRes.ok) {
      const text = await epsRes.text();
      episodesCount = text.split("\n").filter(Boolean).length;
      await db.prepare("INSERT OR REPLACE INTO vidapi_sync_data (key, value, updated_at) VALUES (?, ?, ?)")
        .bind("eps_list_raw", text, Date.now()).run();
      console.log(`[Cron] Episodes raw text synced: ${episodesCount} episodes`);
    }

    // 4. Kirim Notifikasi Telegram
    const message = `🎬 <b>VidAPI Sync Completed</b>\n\n` +
                    `📅 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n\n` +
                    `🎥 Total Movies: <b>${moviesCount.toLocaleString()}</b>\n` +
                    `📺 Total TV Shows: <b>${tvCount.toLocaleString()}</b>\n` +
                    `🎬 Total Episodes: <b>${episodesCount.toLocaleString()}</b>\n\n` +
                    `✅ Semua data tersimpan di D1 SQLite.`;
    
    await sendTelegramNotification(message);

    return NextResponse.json({ 
      success: true, 
      moviesCount, 
      tvCount, 
      episodesCount
    });

  } catch (err: any) {
    console.error("[Cron] Error:", err);
    await sendTelegramNotification(`❌ <b>VidAPI Sync Failed</b>\n\nError: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
