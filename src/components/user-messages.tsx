/**
 * src/components/user-messages.tsx
 *
 * Bell icon dropdown untuk user melihat pesan dari admin.
 * - Polling tiap 60 detik untuk unread count
 * - Click bell → open dropdown with message list
 * - Click message → expand body, mark as read
 * - "Mark all as read" button
 *
 * Cara pakai di header:
 *   import { UserMessages } from "@/components/user-messages";
 *   <UserMessages />
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  info: { color: "text-blue-400", icon: Mail, label: "Info" },
  warning: { color: "text-yellow-400", icon: AlertCircle, label: "Warning" },
  announcement: { color: "text-purple-400", icon: Megaphone, label: "Announcement" },
  system: { color: "text-gray-400", icon: AlertCircle, label: "System" },
};

export function UserMessages() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // === Fetch messages ===
  const fetchMessages = useCallback(async (silent = false) => {
    if (status !== "authenticated") return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/messages", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages(data.messages || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silent fail on background polling
    } finally {
      if (!silent) setLoading(false);
    }
  }, [status]);

  // Initial fetch + polling
  useEffect(() => {
    if (status !== "authenticated") return;
    fetchMessages();
    const interval = setInterval(() => fetchMessages(true), 60000); // poll every 60s
    return () => clearInterval(interval);
  }, [status, fetchMessages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
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
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, is_read: true, read_at: new Date().toISOString() } : m
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/messages/${messageId}`, { method: "PATCH" });
    } catch {
      // revert on failure
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

  // === Toggle expand message ===
  const handleToggleExpand = (msg: UserMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null);
    } else {
      setExpandedId(msg.id);
      // Mark as read when expanded
      if (!msg.is_read) {
        handleMarkAsRead(msg.id);
      }
    }
  };

  // === Don't render if not logged in ===
  if (status !== "authenticated") return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Messages"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border border-border bg-popover shadow-xl z-50 overflow-hidden"
          style={{
            maxHeight: "70vh",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Messages</h3>
              {unreadCount > 0 && (
                <Badge variant="outline" className="border-red-500/40 text-red-400 text-[10px]">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 50px)" }}>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No messages</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {messages.map((msg) => {
                  const meta = TYPE_META[msg.type] || TYPE_META.info;
                  const Icon = meta.icon;
                  const isExpanded = expandedId === msg.id;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "p-3 cursor-pointer transition-colors hover:bg-accent/50",
                        !msg.is_read && "bg-primary/5"
                      )}
                      onClick={() => handleToggleExpand(msg)}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", meta.color)} />

                        <div className="flex-1 min-w-0">
                          {/* Top row: type + unread dot */}
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                {meta.label}
                              </span>
                              {msg.is_pinned === 1 && (
                                <Pin className="h-3 w-3 text-yellow-500" />
                              )}
                              {msg.recipient_id === null && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 h-4 border-purple-500/40 text-purple-400"
                                >
                                  Broadcast
                                </Badge>
                              )}
                            </div>
                            {!msg.is_read && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>

                          {/* Subject */}
                          {msg.subject && (
                            <div className="text-sm font-medium truncate">
                              {msg.subject}
                            </div>
                          )}

                          {/* Body (or preview) */}
                          {isExpanded ? (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                              {msg.body}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {msg.body}
                            </p>
                          )}

                          {/* Meta */}
                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              From: {msg.sender_name || "Admin"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
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
        </div>
      )}
    </div>
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
