/**
 * src/lib/email.ts
 *
 * Email service menggunakan Resend API.
 * - Gratis: 100 email/hari, 3000/bulan
 * - HTTP-based (cocok untuk Cloudflare Workers)
 * - Support single & bulk email
 *
 * Setup:
 *   1. Daftar di https://resend.com (gratis)
 *   2. Get API key dari dashboard
 *   3. Set env var: RESEND_API_KEY=re_xxx
 *   4. (Optional) Verify domain untuk custom sender
 *
 * Cara pakai:
 *   import { sendEmail, sendBroadcastEmail } from "@/lib/email";
 *
 *   await sendEmail({
 *     to: "user@example.com",
 *     subject: "Welcome!",
 *     html: "<h1>Hello</h1>"
 *   });
 */

// ============================================================
// TYPES
// ============================================================
interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

interface BroadcastEmailParams {
  recipients: Array<{ email: string; name?: string | null }>;
  subject: string;
  body: string;
  messageType?: "info" | "warning" | "announcement" | "system";
  senderName?: string | null;
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
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = "https://api.resend.com/emails";

// Default sender (pakai Resend default domain dulu)
// Untuk custom domain, verify di Resend dashboard lalu ganti
const DEFAULT_FROM = "CineStream <onboarding@resend.dev>";

// Batch size (Resend max 50 per request)
const BATCH_SIZE = 50;

// ============================================================
// HTML EMAIL TEMPLATE
// ============================================================
function generateEmailHTML(params: {
  subject: string;
  body: string;
  messageType?: string;
  senderName?: string | null;
}): string {
  const { subject, body, messageType = "info", senderName } = params;

  // Type colors
  const typeColors: Record<string, { bg: string; text: string; label: string }> = {
    info: { bg: "#3b82f6", text: "Info", label: "Info" },
    warning: { bg: "#facc15", text: "Warning", label: "Warning" },
    announcement: { bg: "#a855f7", text: "Announcement", label: "Announcement" },
    system: { bg: "#6b7280", text: "System", label: "System" },
  };
  const typeMeta = typeColors[messageType] || typeColors.info;

  // Convert newlines to <br>
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
  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 0;">
    <tr>
      <td align="center">
        <!-- Container -->
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
              <!-- Type Badge -->
              <div style="display:inline-block;background:${typeMeta.bg};color:#000;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">
                ${typeMeta.label}
              </div>

              <!-- Subject -->
              ${subjectHtml ? `
              <h2 style="color:#fafafa;font-size:20px;font-weight:700;margin:0 0 16px 0;line-height:1.3;">
                ${subjectHtml}
              </h2>
              ` : ''}

              <!-- Body -->
              <div style="color:#d4d4d4;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
                ${bodyHtml}
              </div>

              <!-- Sender -->
              ${senderName ? `
              <div style="color:#737373;font-size:13px;padding-top:16px;border-top:1px solid #262626;">
                — ${senderName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- CTA Button -->
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
// SEND SINGLE EMAIL
// ============================================================
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[EMAIL] RESEND_API_KEY not set, skipping email send");
    return false;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from || DEFAULT_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[EMAIL] Send failed:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[EMAIL] Error:", error);
    return false;
  }
}

// ============================================================
// SEND BROADCAST EMAIL (Bulk)
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

  if (!RESEND_API_KEY) {
    console.warn("[EMAIL] RESEND_API_KEY not set, skipping broadcast");
    result.success = false;
    result.errors.push("RESEND_API_KEY not configured");
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

  // Send in batches
  for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
    const batch = validRecipients.slice(i, i + BATCH_SIZE);
    const toEmails = batch.map((r) => r.email);

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: DEFAULT_FROM,
          to: toEmails,
          subject,
          html,
        }),
      });

      if (response.ok) {
        result.sent += batch.length;
      } else {
        const error = await response.text();
        result.failed += batch.length;
        result.errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error}`);
      }
    } catch (error: any) {
      result.failed += batch.length;
      result.errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error.message}`);
    }

    // Small delay between batches (avoid rate limit)
    if (i + BATCH_SIZE < validRecipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  result.success = result.failed === 0;
  return result;
}

// ============================================================
// HELPER: Check if email is configured
// ============================================================
export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}
