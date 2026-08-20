"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, BellOff } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  data: string | null;
  read: number | boolean;
  createdAt: string;
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: 1 } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error("Gagal update notifikasi");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications?clear=all", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
      setUnreadCount(0);
      toast.success("Semua notifikasi ditandai dibaca");
    } catch {
      toast.error("Gagal update notifikasi");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const deleted = notifications.find((n) => n.id === id);
      if (deleted && !deleted.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      toast.error("Gagal menghapus notifikasi");
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel - FIXED: use fixed positioning to escape header's overflow clip */}
      {open && (
        <div
          ref={menuRef}
          className="fixed right-2 top-16 z-[100] w-[calc(100vw-1rem)] max-w-sm overflow-hidden rounded-lg border border-border bg-popover shadow-2xl sm:right-4 sm:w-96"
          style={{ maxHeight: "calc(100vh - 5rem)" }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notifikasi</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <CheckCheck className="h-3 w-3" />
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List - scrollable */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 8rem)" }}>
            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Memuat...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">
                  Belum ada notifikasi
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "relative px-4 py-3 transition-colors hover:bg-muted/40",
                      !notif.read && "bg-primary/5",
                    )}
                  >
                    {!notif.read && (
                      <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}

                    <div className="min-w-0 pl-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 break-words text-xs font-semibold">
                          {notif.title}
                        </p>
                        <span className="shrink-0 text-[9px] text-muted-foreground">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      
                      <p className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground">
                        {notif.message}
                      </p>

                      <div className="mt-1.5 flex items-center gap-3">
                        {!notif.read && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="flex items-center gap-1 text-[9px] text-primary hover:underline"
                          >
                            <Check className="h-2.5 w-2.5" />
                            Tandai dibaca
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notif.id)}
                          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
