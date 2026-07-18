/**
 * src/app/api/cron/refresh-cookies/route.ts
 *
 * GET /api/cron/refresh-cookies?api_key=ADMIN_API_KEY
 *
 * Cron job tiap 6 jam untuk:
 * 1. Cek apakah cookies cinemacity masih valid
 * 2. Kalau 403, coba re-fetch tanpa PHPSESSID (refresh session)
 * 3. Kalau masih gagal, rotate ke akun cadangan
 * 4. Kalau semua gagal, kirim notif Telegram
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sendTelegramMessage } from "@/lib/telegram";

const CINEMACITY_BASE = "https://cinemacity.cc";
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (!ctx?.env?.DB) throw new Error("D1 not available");
  return ctx.env.DB as D1Database;
}

function cookiesToHeader(cookies: any[]): string {
  return cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
}

// ============================================================
// Cek apakah cookies masih valid (fetch cinemacity homepage)
// ============================================================
async function checkCookiesValid(cookies: any[]): Promise<boolean> {
  try {
    const res = await fetch(`${CINEMACITY_BASE}/`, {
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "text/html,*/*",
        "Cookie": cookiesToHeader(cookies),
        "Referer": CINEMACITY_BASE + "/",
      },
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================
// Refresh: coba fetch TANPA PHPSESSID (biar dapet session baru)
// ============================================================
async function refreshSession(cookies: any[]): Promise<any[] | null> {
  // Hapus PHPSESSID, simpan dle_user_id + dle_password + cf_clearance
  const filteredCookies = cookies.filter(
    (c: any) => c.name !== "PHPSESSID"
  );

  try {
    const res = await fetch(`${CINEMACITY_BASE}/`, {
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "text/html,*/*",
        "Cookie": cookiesToHeader(filteredCookies),
        "Referer": CINEMACITY_BASE + "/",
      },
      redirect: "follow",
    });

    if (!res.ok) return null;

    // Ambil Set-Cookie headers (PHPSESSID baru)
    const setCookieHeaders = res.headers.get("set-cookie");
    if (setCookieHeaders) {
      // Parse PHPSESSID dari Set-Cookie
      const sessMatch = setCookieHeaders.match(/PHPSESSID=([^;]+)/);
      if (sessMatch) {
        const newSess = {
          name: "PHPSESSID",
          value: sessMatch[1],
          domain: ".cinemacity.cc",
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "Lax",
        };
        return [...filteredCookies, newSess];
      }
    }

    // Kalau gak ada Set-Cookie, pakai filtered cookies aja
    return filteredCookies;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const apiKey = url.searchParams.get("api_key");
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const d1 = await getD1();
  const startTime = Date.now();

  // Get ALL cookie accounts
  const accounts = await d1
    .prepare(`SELECT * FROM cinemacity_cookies ORDER BY is_active DESC, id ASC`)
    .all<{
      id: number;
      label: string;
      cookies_json: string;
      is_active: number;
      notes: string | null;
    }>();

  if (!accounts.results || accounts.results.length === 0) {
    return NextResponse.json({ error: "No cookie accounts found" }, { status: 404 });
  }

  let activeAccount = null;
  let refreshed = false;

  for (const account of accounts.results) {
    const cookies = JSON.parse(account.cookies_json);

    // Step 1: Cek apakah cookies masih valid
    console.log(`[Cron] Checking account: ${account.label}`);
    const isValid = await checkCookiesValid(cookies);

    if (isValid) {
      console.log(`[Cron] ✅ Account ${account.label} is valid`);
      activeAccount = account;
      break;
    }

    // Step 2: Coba refresh (hapus PHPSESSID, fetch ulang)
    console.log(`[Cron] ⚠️ Account ${account.label} is invalid, trying refresh...`);
    const refreshedCookies = await refreshSession(cookies);

    if (refreshedCookies) {
      // Cek lagi apakah refreshed cookies valid
      const isValidAfterRefresh = await checkCookiesValid(refreshedCookies);

      if (isValidAfterRefresh) {
        console.log(`[Cron] ✅ Account ${account.label} refreshed successfully!`);
        
        // Update cookies di D1
        await d1
          .prepare(
            `UPDATE cinemacity_cookies 
             SET cookies_json = ?, last_refreshed = datetime('now'), updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(JSON.stringify(refreshedCookies), account.id)
          .run();

        // Set sebagai active
        await d1.prepare(`UPDATE cinemacity_cookies SET is_active = 0`).run();
        await d1
          .prepare(`UPDATE cinemacity_cookies SET is_active = 1 WHERE id = ?`)
          .bind(account.id)
          .run();

        activeAccount = { ...account, cookies_json: JSON.stringify(refreshedCookies) };
        refreshed = true;
        break;
      }
    }

    console.log(`[Cron] ❌ Account ${account.label} refresh failed`);
  }

  const botToken = process.env.TELEGRAM_API_KEY || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!activeAccount) {
    // Semua akun gagal — kirim notif Telegram
    console.log("[Cron] ❌ All cookie accounts failed!");

    if (botToken && chatId) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `🚨 <b>CINEMACITY COOKIES EXPIRED!</b>\n\n` +
          `Semua akun tumbal sudah tidak valid.\n` +
          `Website tidak bisa fetch film dari cinemacity.cc.\n\n` +
          `<b>Aksi yang diperlukan:</b>\n` +
          `1. Buka cinemacity.cc di browser\n` +
          `2. Login dengan akun tumbal\n` +
          `3. Export cookies (Cookie-Editor)\n` +
          `4. Upload via /admin/cinemacity-cookies\n` +
          `5. Atau jalankan script Colab upload-cookies.py\n\n` +
          `⏱ Checked at: ${new Date().toISOString()}`
      );
    }

    // Hapus semua cache (supaya gak pakai data lama)
    await d1.prepare(`DELETE FROM cinemacity_proxy_cache`).run();

    return NextResponse.json({
      success: false,
      error: "All cookie accounts expired",
      action: "Telegram notification sent",
      accountsChecked: accounts.results.length,
      durationMs: Date.now() - startTime,
    });
  }

  // Hapus cache lama kalau cookies baru (supaya fetch fresh)
  if (refreshed) {
    await d1.prepare(`DELETE FROM cinemacity_proxy_cache`).run();
    console.log("[Cron] Cache cleared (cookies refreshed)");
  }

  const duration = Date.now() - startTime;

  // Notif sukses (hanya kalau ada refresh, bukan tiap 6 jam)
  if (refreshed && botToken && chatId) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `✅ <b>Cookies Auto-Refreshed</b>\n\n` +
        `Account: ${activeAccount.label}\n` +
        `Status: Active\n` +
        `PHPSESSID: New session obtained\n\n` +
        `Website siap melayani request.`
    );
  }

  return NextResponse.json({
    success: true,
    activeAccount: activeAccount.label,
    refreshed,
    accountsChecked: accounts.results.length,
    cacheCleared: refreshed,
    durationMs: duration,
    checkedAt: new Date().toISOString(),
  });
}
