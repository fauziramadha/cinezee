/**
 * src/lib/telegram.ts
 * Kirim notifikasi ke Telegram via Bot API.
 */

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error("[Telegram] Send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Telegram] Error:", err);
    return false;
  }
}
