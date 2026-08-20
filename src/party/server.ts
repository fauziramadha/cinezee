import type { PartyKitServer } from "partykit/server";

// ============================================================
// TIER LIMITS — sesuai keputusan kamu
// ============================================================
const TIER_LIMITS: Record<string, number> = {
  free: 2,
  premium: 5,
  family: 10,
};

// ============================================================
// EVENT TYPES — disepakati antara server & client
// ============================================================
type PartyEvent =
  | { type: "sync"; isPlaying: boolean; currentTime: number; senderId: string }
  | { type: "chat"; id: string; userId: string; userName: string; userImage: string | null; content: string; createdAt: string }
  | { type: "presence"; participants: Participant[] }
  | { type: "system"; message: string; createdAt: string }
  | { type: "error"; message: string };

interface Participant {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  isHost: boolean;
  joinedAt: string;
}

// ============================================================
// HELPERS
// ============================================================
function getParticipantFromConnection(conn: any): Participant {
  return {
    id: conn.id,
    userId: conn.state?.userId || "anonymous",
    userName: conn.state?.userName || "Guest",
    userImage: conn.state?.userImage || null,
    isHost: !!conn.state?.isHost,
    joinedAt: conn.state?.joinedAt || new Date().toISOString(),
  };
}

function broadcastPresence(room: any) {
  const participants: Participant[] = Array.from(
    room.connections.values()
  ).map(getParticipantFromConnection);

  const event: PartyEvent = {
    type: "presence",
    participants,
  };

  room.broadcast(JSON.stringify(event));
}

function broadcastSystem(room: any, message: string) {
  const event: PartyEvent = {
    type: "system",
    message,
    createdAt: new Date().toISOString(),
  };
  room.broadcast(JSON.stringify(event));
}

// ============================================================
// onBeforeConnect — validasi sebelum user connect
// ============================================================
export default {
  async onBeforeConnect(req: Request, room: any) {
    // Ambil query params dari URL connect
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || "anonymous";
    const userName = url.searchParams.get("userName") || "Guest";
    const userImage = url.searchParams.get("userImage") || "";
    const tier = url.searchParams.get("tier") || "free";
    const isHost = url.searchParams.get("isHost") === "true";

    // Cek tier limit (kalau bukan host pertama)
    const currentCount = room.connections.size;
    const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Host pertama selalu boleh connect
    // Peserta lain dicek limit
    if (!isHost && currentCount >= limit) {
      return new Response(
        JSON.stringify({ error: "Room full", limit }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Attach state ke connection (akan dipakai di onConnect)
    return {
      state: {
        userId,
        userName,
        userImage: userImage || null,
        isHost,
        tier,
        joinedAt: new Date().toISOString(),
      },
    };
  },

  // ============================================================
  // onConnect — saat WebSocket terbuka
  // ============================================================
  async onConnect(connection: any, room: any) {
    // Welcome message ke user baru
    connection.send(
      JSON.stringify({
        type: "system",
        message: `Welcome, ${connection.state?.userName || "Guest"}!`,
        createdAt: new Date().toISOString(),
      } satisfies PartyEvent)
    );

    // Broadcast ke semua: ada user baru
    broadcastSystem(
      room,
      `${connection.state?.userName || "Guest"} joined the party`
    );

    // Update presence list ke semua
    broadcastPresence(room);

    // ============================================================
    // onMessage — handle event dari client
    // ============================================================
    connection.addEventListener("message", (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as PartyEvent;

        switch (event.type) {
          case "sync": {
            // Hanya host yang bisa sync playback
            if (!connection.state?.isHost) return;
            // Broadcast ke semua peserta (kecuali pengirim)
            room.broadcast(JSON.stringify(event), [connection.id]);
            break;
          }

          case "chat": {
            // Broadcast pesan ke semua peserta
            const chatEvent: PartyEvent = {
              type: "chat",
              id: event.id,
              userId: connection.state?.userId || "anonymous",
              userName: connection.state?.userName || "Guest",
              userImage: connection.state?.userImage || null,
              content: event.content,
              createdAt: new Date().toISOString(),
            };
            room.broadcast(JSON.stringify(chatEvent));
            break;
          }

          default:
            // Ignore unknown events
            break;
        }
      } catch (err) {
        console.error("[PartyKit] Invalid message:", err);
      }
    });
  },

  // ============================================================
  // onClose — saat user disconnect
  // ============================================================
  async onClose(connection: any, room: any) {
    const userName = connection.state?.userName || "Guest";
    const wasHost = connection.state?.isHost;

    // Notifikasi semua: user keluar
    broadcastSystem(room, `${userName} left the party`);

    // Update presence
    broadcastPresence(room);

    // Kalau host keluar, elect host baru (peserta dengan join time terlama)
    if (wasHost && room.connections.size > 0) {
      const connections = Array.from(room.connections.values()) as any[];
      // Sort by joinedAt ascending (terlama di depan)
      connections.sort((a, b) => {
        const aTime = new Date(a.state?.joinedAt || 0).getTime();
        const bTime = new Date(b.state?.joinedAt || 0).getTime();
        return aTime - bTime;
      });

      const newHost = connections[0];
      if (newHost) {
        newHost.state.isHost = true;
        newHost.send(
          JSON.stringify({
            type: "system",
            message: "You are now the host",
            createdAt: new Date().toISOString(),
          } satisfies PartyEvent)
        );
        broadcastSystem(
          room,
          `${newHost.state?.userName || "Guest"} is now the host`
        );
        broadcastPresence(room);
      }
    }
  },

  // ============================================================
  // onRequest — HTTP endpoint untuk cek status room
  // ============================================================
  async onRequest(req: Request, room: any) {
    if (req.method === "GET") {
      // Return participant count & status
      const participants = Array.from(room.connections.values()).map(
        getParticipantFromConnection
      );
      return new Response(
        JSON.stringify({
          roomId: room.id,
          participantCount: participants.length,
          participants,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Method not allowed", { status: 405 });
  },
} satisfies PartyKitServer;
