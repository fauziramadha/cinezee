"use client";

import { usePartySocket } from "partysocket/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// TYPES — sync dengan src/party/server.ts
// ============================================================
type PartyEvent =
  | { type: "sync"; isPlaying: boolean; currentTime: number; senderId: string }
  | {
      type: "chat";
      id: string;
      userId: string;
      userName: string;
      userImage: string | null;
      content: string;
      createdAt: string;
    }
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

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  content: string;
  createdAt: string;
  isSystem?: boolean;
}

// ============================================================
// CONFIG
// ============================================================
const PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
  "cinezee-watch-party.fauziramadhani4321.partykit.dev";

// ============================================================
// HOOK: useWatchParty
// ============================================================
interface UseWatchPartyOptions {
  roomId: string;
  userId: string;
  userName: string;
  userImage?: string | null;
  tier?: string;
  isHost?: boolean;
  onSync?: (isPlaying: boolean, currentTime: number) => void;
}

export function useWatchParty({
  roomId,
  userId,
  userName,
  userImage,
  tier = "free",
  isHost = false,
  onSync,
}: UseWatchPartyOptions) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSyncRef = useRef(onSync);
  const socketRef = useRef<WebSocket | null>(null);

  // Update ref supaya callback selalu fresh
  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  // Buat WebSocket connection via partysocket
  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomId,
    party: "main",
    query: {
      userId,
      userName: encodeURIComponent(userName),
      userImage: userImage ? encodeURIComponent(userImage) : "",
      tier,
      isHost: isHost ? "true" : "false",
    },
    onOpen: () => {
      setConnected(true);
      setError(null);
    },
    onClose: () => {
      setConnected(false);
    },
    onError: (e) => {
      console.error("[PartyKit] Connection error:", e);
      setError("Connection failed");
      setConnected(false);
    },
    onMessage: (e) => {
      try {
        const event = JSON.parse(e.data as string) as PartyEvent;

        switch (event.type) {
          case "sync":
            // Jangan apply ke pengirim sendiri
            if (event.senderId !== userId) {
              onSyncRef.current?.(event.isPlaying, event.currentTime);
            }
            break;

          case "chat":
            setMessages((prev) => [
              ...prev,
              {
                id: event.id,
                userId: event.userId,
                userName: event.userName,
                userImage: event.userImage,
                content: event.content,
                createdAt: event.createdAt,
              },
            ]);
            break;

          case "system":
            setMessages((prev) => [
              ...prev,
              {
                id: `system-${Date.now()}-${Math.random()}`,
                userId: "system",
                userName: "System",
                userImage: null,
                content: event.message,
                createdAt: event.createdAt,
                isSystem: true,
              },
            ]);
            break;

          case "presence":
            setParticipants(event.participants);
            break;

          case "error":
            setError(event.message);
            break;
        }
      } catch (err) {
        console.error("[PartyKit] Parse error:", err);
      }
    },
  });

  // Simpan socket ke ref
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // ============================================================
  // ACTIONS
  // ============================================================

  // Kirim sync event (hanya host)
  const sendSync = useCallback(
    (isPlaying: boolean, currentTime: number) => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)
        return;
      const event: PartyEvent = {
        type: "sync",
        isPlaying,
        currentTime,
        senderId: userId,
      };
      socketRef.current.send(JSON.stringify(event));
    },
    [userId]
  );

  // Kirim chat message
  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)
        return;
      const event: PartyEvent = {
        type: "chat",
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        userId,
        userName,
        userImage: userImage || null,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      socketRef.current.send(JSON.stringify(event));
    },
    [userId, userName, userImage]
  );

  return {
    connected,
    error,
    participants,
    messages,
    sendSync,
    sendMessage,
  };
}

// ============================================================
// HELPER: Buat room ID unik
// ============================================================
export function generateRoomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// ============================================================
// HELPER: Get tier limit
// ============================================================
export const TIER_LIMITS: Record<string, number> = {
  free: 2,
  premium: 5,
  family: 10,
};

export function getTierLimit(tier: string): number {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}
