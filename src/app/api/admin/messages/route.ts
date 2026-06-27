/**
 * src/app/api/admin/messages/route.ts (REVISED - Email Notification)
 *
 * GET  /api/admin/messages        - List all messages sent (admin only)
 * POST /api/admin/messages        - Send message (to user or broadcast)
 *
 * POST body tambahan:
 *   sendEmail?: boolean  - Set true untuk kirim email notifikasi ke penerima
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbMessage } from "@/lib/db-extended";
import { sendEmail, sendBroadcastEmail } from "@/lib/email";

// === Helper: Check admin access ===
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if ((session.user as any).role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// === GET: List all messages with stats ===
export async function GET() {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const messages = await dbMessage.listAll();

    // Attach recipient count for each message
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const stats = await dbMessage.getStats(msg.id);
        return {
          ...msg,
          recipient_count: stats.recipientCount,
          read_count: stats.readCount,
        };
      })
    );

    return NextResponse.json({ messages: enriched });
  } catch (error) {
    console.error("[ADMIN MESSAGES GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// === POST: Send message (dengan optional email notification) ===
// Body:
//   { recipientId: string | null,  // null = broadcast to all
//     recipientName?: string,
//     subject?: string,
//     body: string,
//     type?: "info" | "warning" | "announcement" | "system",
//     isPinned?: boolean,
//     expiresAt?: string | null,
//     sendEmail?: boolean  // ← NEW: set true untuk kirim email
//   }
export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const body = await request.json();

    if (!body.body || body.body.trim().length === 0) {
      return NextResponse.json(
        { error: "Message body is required" },
        { status: 400 }
      );
    }

    const senderId = (adminCheck as any).session.user.id;
    const senderName = (adminCheck as any).session.user.name || null;
    const isBroadcast = !body.recipientId; // null = broadcast

    // ============================================================
    // 1. SIMPAN MESSAGE KE DATABASE (selalu dilakukan)
    // ============================================================
    const messageId = await dbMessage.send({
      senderId,
      senderName,
      recipientId: body.recipientId || null, // null = broadcast
      recipientName: body.recipientName || null,
      subject: body.subject || null,
      body: body.body,
      type: body.type || "info",
      isPinned: Boolean(body.isPinned),
      expiresAt: body.expiresAt || null,
    });

    // ============================================================
    // 2. KIRIM EMAIL (hanya jika diminta)
    // ============================================================
    let emailResult = null;

    if (body.sendEmail === true) {
      try {
        if (isBroadcast) {
          // === BROADCAST: kirim ke semua user yang punya email ===
          const users = await dbMessage.listUsers(500); // max 500 user
          const recipients = users
            .filter((u) => u.email)
            .map((u) => ({ email: u.email as string, name: u.name }));

          if (recipients.length > 0) {
            emailResult = await sendBroadcastEmail({
              recipients,
              subject: body.subject || "Notification",
              body: body.body,
              messageType: body.type || "info",
              senderName,
            });

            console.log(
              `[EMAIL] Broadcast sent: ${emailResult.sent} success, ${emailResult.failed} failed`
            );
          } else {
            emailResult = {
              success: false,
              sent: 0,
              failed: 0,
              errors: ["No users with email found"],
            };
          }
        } else {
          // === DIRECT MESSAGE: kirim ke 1 user ===
          // Ambil email penerima dari DB
          const users = await dbMessage.listUsers(500);
          const recipient = users.find((u) => u.id === body.recipientId);

          if (recipient?.email) {
            const html = generateDirectEmailHTML({
              subject: body.subject || "",
              body: body.body,
              messageType: body.type || "info",
              senderName,
              recipientName: recipient.name,
            });

            const success = await sendEmail({
              to: recipient.email,
              subject: `[CineStream] ${body.subject || "Notification"}`,
              html,
            });

            emailResult = {
              success,
              sent: success ? 1 : 0,
              failed: success ? 0 : 1,
              errors: success ? [] : ["Failed to send email"],
            };
          } else {
            emailResult = {
              success: false,
              sent: 0,
              failed: 0,
              errors: ["Recipient has no email"],
            };
          }
        }
      } catch (emailError: any) {
        console.error("[EMAIL] Send failed:", emailError);
        emailResult = {
          success: false,
          sent: 0,
          failed: 0,
          errors: [emailError.message || "Email service error"],
        };
      }
    }

    // ============================================================
    // 3. RETURN RESPONSE
    // ============================================================
    return NextResponse.json({
      id: messageId,
      success: true,
      email: emailResult,
    });
  } catch (error) {
    console.error("[ADMIN MESSAGES POST]", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPER: Generate HTML untuk direct message (lebih personal)
// ============================================================
function generateDirectEmailHTML(params: {
  subject: string;
  body: string;
  messageType?: string;
  senderName?: string | null;
  recipientName?: string | null;
}): string {
  const { subject, body, messageType = "info", senderName, recipientName } = params;

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

  const greeting = recipientName
    ? `Halo ${recipientName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")},`
    : "Halo,";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CineStream Message</title>
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
                Pesan untuk Anda
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 40px;">
              <div style="display:inline-block;background:${typeMeta.bg};color:#000;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">
                ${typeMeta.label}
              </div>

              <p style="color:#d4d4d4;font-size:15px;margin:0 0 16px 0;">
                ${greeting}
              </p>

              ${subject ? `
              <h2 style="color:#fafafa;font-size:20px;font-weight:700;margin:0 0 16px 0;line-height:1.3;">
                ${subject.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
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
                Pesan ini dikirim langsung ke Anda dari admin CineStream.
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
