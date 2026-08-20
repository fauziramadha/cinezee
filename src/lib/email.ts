/**
 * src/lib/email.ts (BREVO VERSION)
 *
 * Email service menggunakan Brevo API (sebelumnya SendinBlue).
 * - Gratis: 300 email/hari
 * - Bisa kirim ke email siapapun (tidak restrict seperti Resend)
 * - HTTP-based (cocok untuk Cloudflare Workers)
 *
 * Setup:
 *   1. Daftar di https://www.brevo.com (gratis)
 *   2. Verify email sender di Brevo Dashboard
 *   3. Get API key dari SMTP & API settings
 *   4. Set env var: BREVO_API_KEY=xkeysib-xxx
 *   5. Set env var: BREVO_SENDER_EMAIL=noreply@yourdomain.com
 *   6. Set env var: BREVO_SENDER_NAME=CineStream
 *
 * Cara pakai:
 *   import { sendEmail, sendBroadcastEmail } from "@/lib/email";
 */

// ============================================================
// TYPES
// ============================================================
interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: { email: string; name: string };
}

interface BroadcastEmailParams {
  recipients: Array<{ email: string; name?: string | null }>;
  subject: string;
  body: string;
  messageType?: "info" | "warning" | "announcement" | "system";
  senderName?: string | null;
}

interface EmailSendResult {
  success: boolean;
  error?: string;
}

interface EmailResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

// ============================================================
// CONFIG
// ============================================================
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Sender dari env vars (wajib diset di Cloudflare Secrets)
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "noreply@cinestream.app";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "CineStream";

// Default sender object
const DEFAULT_FROM = {
  email: SENDER_EMAIL,
  name: SENDER_NAME,
};

// ============================================================
// HTML EMAIL TEMPLATE (BROADCAST)
// ============================================================
function generateEmailHTML(params: {
  subject: string;
  body: string;
  messageType?: string;
  senderName?: string | null;
}): string {
  const { subject, body, messageType = "info", senderName } = params;

  const typeColors: Record<string, { bg: string; label: string }> = {
    info: { bg: "#3b82f6", label: "Info" },
    warning: { bg: "#facc15", label: "Warning" },
    announcement: { bg: "#a855f7", label: "Announcement" },
    system: { bg: "#6b7280", label: "System" },
  };
  const typeMeta = typeColors[messageType] || typeColors.info;

  const bodyHtml = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const subjectHtml = subject
    ? subject.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CineStream Notification</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#171717;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#B20710 0%,#8B0000 100%);padding:32px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);width:56px;height:56px;line-height:56px;border-radius:14px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-1px;margin-bottom:16px;">
                CS
              </div>
              <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;letter-spacing:-0.5px;">
                CineStream
              </h1>
              <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:4px 0 0 0;">
                Streaming tanpa batas
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 40px;">
              <div style="display:inline-block;background:${typeMeta.bg};color:#000;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">
                ${typeMeta.label}
              </div>

              ${subjectHtml ? `
              <h2 style="color:#fafafa;font-size:20px;font-weight:700;margin:0 0 16px 0;line-height:1.3;">
                ${subjectHtml}
              </h2>
              ` : ''}

              <div style="color:#d4d4d4;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
                ${bodyHtml}
              </div>

              ${senderName ? `
              <div style="color:#737373;font-size:13px;padding-top:16px;border-top:1px solid #262626;">
                — ${senderName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 32px 40px;text-align:center;">
              <a href="https://cinezee.fauziramadhani4321.workers.dev"
                 style="display:inline-block;background:#B20710;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
                Buka CineStream
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background:#0a0a0a;border-top:1px solid #262626;">
              <p style="color:#525252;font-size:12px;margin:0;text-align:center;line-height:1.5;">
                Anda menerima email ini karena terdaftar di CineStream.<br>
                Untuk berhenti berlangganan, login ke akun Anda dan ubah pengaturan notifikasi.
              </p>
              <p style="color:#404040;font-size:11px;margin:12px 0 0 0;text-align:center;">
                © 2026 CineStream. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================
// SEND SINGLE EMAIL (Brevo API)
// ============================================================
export async function sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
  if (!BREVO_API_KEY) {
    console.warn("[EMAIL] BREVO_API_KEY not set, skipping email send");
    return { success: false, error: "BREVO_API_KEY not configured" };
  }

  // Format recipients untuk Brevo (array of {email, name})
  const toArray = Array.isArray(params.to)
    ? params.to.map((email) => ({ email }))
    : [{ email: params.to }];

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: params.from || DEFAULT_FROM,
        to: toArray,
        subject: params.subject,
        htmlContent: params.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `HTTP ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.message || errorJson.error || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }

      console.error("[EMAIL] Send failed:", response.status, errorMsg);
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[EMAIL] Error:", error);
    return { success: false, error: error.message || "Network error" };
  }
}

// ============================================================
// SEND BROADCAST EMAIL (Brevo - satu per satu)
// ============================================================
export async function sendBroadcastEmail(
  params: BroadcastEmailParams
): Promise<EmailResult> {
  const result: EmailResult = {
    success: true,
    sent: 0,
    failed: 0,
    errors: [],
  };

  if (!BREVO_API_KEY) {
    console.warn("[EMAIL] BREVO_API_KEY not set, skipping broadcast");
    result.success = false;
    result.errors.push("BREVO_API_KEY not configured");
    return result;
  }

  // Filter valid emails
  const validRecipients = params.recipients.filter(
    (r) => r.email && r.email.includes("@")
  );

  if (validRecipients.length === 0) {
    result.success = false;
    result.errors.push("No valid email recipients");
    return result;
  }

  // Generate HTML once
  const html = generateEmailHTML({
    subject: params.subject || "",
    body: params.body,
    messageType: params.messageType,
    senderName: params.senderName,
  });

  const subject = `[CineStream] ${params.subject || "Notification"}`;

  // Brevo tidak punya batch endpoint khusus, kirim satu per satu
  // Tapi tetap bisa parallel dengan limit (5 concurrent)
  const CONCURRENT_LIMIT = 5;
  const chunks: typeof validRecipients[] = [];

  for (let i = 0; i < validRecipients.length; i += CONCURRENT_LIMIT) {
    chunks.push(validRecipients.slice(i, i + CONCURRENT_LIMIT));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (recipient) => {
      const sendResult = await sendEmail({
        to: recipient.email,
        subject,
        html,
      });

      if (sendResult.success) {
        result.sent++;
      } else {
        result.failed++;
        // Hanya simpan 3 error pertama untuk avoid spam
        if (result.errors.length < 3) {
          result.errors.push(`${recipient.email}: ${sendResult.error}`);
        }
      }
    });

    await Promise.all(promises);

    // Small delay antar chunk (avoid rate limit)
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  result.success = result.failed === 0;
  return result;
}

// ============================================================
// HELPER: Check if email is configured
// ============================================================
export function isEmailConfigured(): boolean {
  return !!BREVO_API_KEY;
}
