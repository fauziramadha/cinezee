/**
 * src/components/user-messages.tsx (FINAL v3 - Portal + Inline Styles)
 *
 * Bell icon dropdown untuk user melihat pesan dari admin.
 * - Polling tiap 60 detik untuk unread count
 * - Click bell → open dropdown (render via Portal ke body)
 * - Click message → expand body, mark as read
 * - "Mark all as read" button
 * - Mobile-first: width kecil (280px), compact, pasti muat layar
 *
 * Cara pakai di header:
 *   import { UserMessages } from "@/components/user-messages";
 *   <UserMessages />
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import {
  Bell,
  Mail,
  AlertCircle,
  Megaphone,
  Pin,
  X,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface UserMessage {
  id: number;
  sender_name: string | null;
  recipient_id: string | null;
  recipient_name: string | null;
  subject: string | null;
  body: string;
  type: string;
  is_pinned: number;
  is_read?: boolean;
  read_at?: string | null;
  created_at: string;
}

const TYPE_META: Record<string, { color: string; icon: any; label: string }> = {
  info: { color: "#60a5fa", icon: Mail, label: "Info" },
  warning: { color: "#facc15", icon: AlertCircle, label: "Warning" },
  announcement: { color: "#c084fc", icon: Megaphone, label: "Announcement" },
  system: { color: "#9ca3af", icon: AlertCircle, label: "System" },
};

export function UserMessages() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  // === Mount check (untuk Portal) ===
  useEffect(() => {
    setMounted(true);
  }, []);

  // === Fetch messages ===
  const fetchMessages = useCallback(async (silent = false) => {
    if (status !== "authenticated") return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages(data.messages || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silent fail
    } finally {
      if (!silent) setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchMessages();
    const interval = setInterval(() => fetchMessages(true), 60000);
    return () => clearInterval(interval);
  }, [status, fetchMessages]);

  // === Hitung posisi dropdown saat open ===
  useEffect(() => {
    if (!open || !bellRef.current) return;

    const updatePosition = () => {
      const rect = bellRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vw = window.innerWidth;
      let dropdownWidth = 280;
      if (vw >= 640) dropdownWidth = 360;

      let right = vw - rect.right;
      if (right + dropdownWidth > vw - 8) {
        right = Math.max(8, vw - dropdownWidth - 8);
      }

      const top = rect.bottom + 8;
      setDropdownPos({ top, right });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // === Close dropdown when clicking outside ===
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // === Mark as read ===
  const handleMarkAsRead = async (messageId: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, is_read: true, read_at: new Date().toISOString() } : m
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/messages/${messageId}`, { method: "PATCH" });
    } catch {
      fetchMessages(true);
    }
  };

  // === Mark all as read ===
  const handleMarkAllRead = async () => {
    setMessages((prev) =>
      prev.map((m) => ({ ...m, is_read: true, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);
    try {
      await fetch("/api/messages", { method: "PATCH" });
      toast.success("All messages marked as read");
    } catch {
      fetchMessages(true);
    }
  };

  // === Toggle expand ===
  const handleToggleExpand = (msg: UserMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null);
    } else {
      setExpandedId(msg.id);
      if (!msg.is_read) handleMarkAsRead(msg.id);
    }
  };

  // === Handle bell click ===
  const handleBellClick = () => {
    if (!open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      let dropdownWidth = 280;
      if (vw >= 640) dropdownWidth = 360;

      let right = vw - rect.right;
      if (right + dropdownWidth > vw - 8) {
        right = Math.max(8, vw - dropdownWidth - 8);
      }

      setDropdownPos({
        top: rect.bottom + 8,
        right,
      });
    }
    setOpen(!open);
  };

  if (status !== "authenticated") return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const dropdownWidth = vw >= 640 ? 360 : 280;

  return (
    <>
      {/* === BELL BUTTON === */}
      <button
        ref={bellRef}
        onClick={handleBellClick}
        aria-label="Messages"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          borderRadius: "9999px",
          backgroundColor: "rgba(255,255,255,0.1)",
          border: "none",
          color: "white",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
        }}
      >
        <Bell style={{ width: "16px", height: "16px" }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              minWidth: "16px",
              height: "16px",
              padding: "0 4px",
              borderRadius: "9999px",
              backgroundColor: "#ef4444",
              color: "white",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* === DROPDOWN via PORTAL === */}
      {mounted && open && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${dropdownPos.top}px`,
            right: `${dropdownPos.right}px`,
            width: `${dropdownWidth}px`,
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "60vh",
            backgroundColor: "#0a0a0a",
            border: "1px solid #262626",
            borderRadius: "12px",
            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6)",
            zIndex: 99999,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* === HEADER === */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "4px",
              padding: "8px 10px",
              borderBottom: "1px solid #262626",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                minWidth: 0,
              }}
            >
              <h3
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  margin: 0,
                  color: "#fafafa",
                }}
              >
                Messages
              </h3>
              {unreadCount > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: "16px",
                    padding: "0 5px",
                    borderRadius: "9999px",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#f87171",
                    fontSize: "10px",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  style={{
                    height: "26px",
                    padding: "0 6px",
                    background: "transparent",
                    border: "none",
                    color: "#a3a3a3",
                    fontSize: "10px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <CheckCheck style={{ width: "12px", height: "12px" }} />
                  <span>Read all</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: "26px",
                  height: "26px",
                  background: "transparent",
                  border: "none",
                  color: "#a3a3a3",
                  cursor: "pointer",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X style={{ width: "13px", height: "13px" }} />
              </button>
            </div>
          </div>

          {/* === BODY — scrollable === */}
          <div
            style={{
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              flex: 1,
              minHeight: 0,
            }}
          >
            {loading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "24px 0",
                }}
              >
                <Loader2
                  className="animate-spin"
                  style={{
                    width: "18px",
                    height: "18px",
                    color: "#a3a3a3",
                  }}
                />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ padding: "32px 12px", textAlign: "center" }}>
                <Mail
                  style={{
                    width: "28px",
                    height: "28px",
                    margin: "0 auto 6px",
                    color: "#525252",
                  }}
                />
                <p
                  style={{
                    fontSize: "12px",
                    color: "#737373",
                    margin: 0,
                  }}
                >
                  No messages
                </p>
              </div>
            ) : (
              <div>
                {messages.map((msg, idx) => {
                  const meta = TYPE_META[msg.type] || TYPE_META.info;
                  const Icon = meta.icon;
                  const isExpanded = expandedId === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleToggleExpand(msg)}
                      style={{
                        padding: "8px 10px",
                        cursor: "pointer",
                        transition: "background-color 0.15s",
                        backgroundColor: !msg.is_read
                          ? "rgba(239,68,68,0.05)"
                          : "transparent",
                        borderBottom:
                          idx < messages.length - 1
                            ? "1px solid #1a1a1a"
                            : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = !msg.is_read
                          ? "rgba(239,68,68,0.05)"
                          : "transparent";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          alignItems: "flex-start",
                        }}
                      >
                        <Icon
                          style={{
                            width: "14px",
                            height: "14px",
                            color: meta.color,
                            flexShrink: 0,
                            marginTop: "2px",
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Top row: type + badges */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "4px",
                              marginBottom: "3px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 500,
                                  color: "#737373",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {meta.label}
                              </span>
                              {msg.is_pinned === 1 && (
                                <Pin
                                  style={{
                                    width: "10px",
                                    height: "10px",
                                    color: "#eab308",
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              {msg.recipient_id === null && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    height: "14px",
                                    padding: "0 4px",
                                    borderRadius: "9999px",
                                    border: "1px solid rgba(192,132,252,0.4)",
                                    color: "#c084fc",
                                    fontSize: "8px",
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}
                                >
                                  BC
                                </span>
                              )}
                            </div>
                            {!msg.is_read && (
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "9999px",
                                  backgroundColor: "#dc2626",
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </div>

                          {/* Subject */}
                          {msg.subject && (
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "#fafafa",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                marginBottom: "2px",
                              }}
                            >
                              {msg.subject}
                            </div>
                          )}

                          {/* Body */}
                          {isExpanded ? (
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#a3a3a3",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                margin: "3px 0 0 0",
                                lineHeight: 1.4,
                              }}
                            >
                              {msg.body}
                            </p>
                          ) : (
                            <p
                              style={{
                                fontSize: "10px",
                                color: "#737373",
                                margin: "1px 0 0 0",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                wordBreak: "break-word",
                                lineHeight: 1.4,
                              }}
                            >
                              {msg.body}
                            </p>
                          )}

                          {/* Meta */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "6px",
                              marginTop: "4px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "9px",
                                color: "#525252",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              From: {msg.sender_name || "Admin"}
                            </span>
                            <span
                              style={{
                                fontSize: "9px",
                                color: "#525252",
                                flexShrink: 0,
                              }}
                            >
                              {formatRelativeTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// === Helper: Format relative time ===
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
