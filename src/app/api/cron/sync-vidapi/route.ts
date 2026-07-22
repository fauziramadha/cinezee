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
  console.log("[Telegram] Bot token exists:", !!botToken);
  console.log("[Telegram] Chat ID exists:", !!chatId);
  if (!botToken || !chatId) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
    const result = await response.json();
    if (!response.ok) console.error("[Telegram] API Error:", JSON.stringify(result));
    else console.log("[Telegram] Notification sent successfully!");
  } catch (e) { console.error("[Telegram] Send error:", e); }
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
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  try {
    console.log("[Cron] Mulai sinkronisasi VidAPI (Raw Text Mode)...");
    let moviesCount = 0, tvCount = 0, episodesCount = 0;

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

    // 3. Sync Episodes Raw Text (7MB) ke KV
    if (kv) {
      const epsRes = await fetch("https://vidapi.ru/ids/eps_list_imdb.txt", { headers: { "User-Agent": UA } });
      if (epsRes.ok) {
        const text = await epsRes.text();
        episodesCount = text.split("\n").length;
        await kv.put("eps_list_raw", text, { expirationTtl: 86400 });
      }
    }

    // 4. Kirim Notifikasi Telegram
    const message = `🎬 <b>VidAPI Sync Completed</b>\n\n` +
      `📅 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n\n` +
      `🎥 Movies: <b>${moviesCount.toLocaleString()}</b>\n` +
      `📺 TV Shows: <b>${tvCount.toLocaleString()}</b>\n` +
      `🎬 Episodes: <b>${episodesCount.toLocaleString()}</b>\n\n` +
      `✅ Data tersimpan (Raw Text).`;
    
    await sendTelegramNotification(message);

    return NextResponse.json({ success: true, moviesCount, tvCount, episodesCount });

  } catch (err: any) {
    console.error("[Cron] Error:", err);
    await sendTelegramNotification(`❌ <b>VidAPI Sync Failed</b>\n\nError: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
