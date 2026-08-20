/**
 * src/components/admin/admin-dashboard.tsx
 *
 * Admin Dashboard UI:
 * - 12 stat cards (users, watchlist, history, ratings, comments, etc)
 * - 3 recent activity lists (recent users, recent messages, recent plays)
 * - Quick action buttons
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Bookmark,
  History,
  Star,
  MessageSquare,
  Bell,
  Mail,
  Server,
  Play,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  Megaphone,
  UserPlus,
  Film,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Stats {
  totalUsers: number;
  recentUsers: number;
  totalWatchlist: number;
  totalHistory: number;
  totalRatings: number;
  totalComments: number;
  totalNotifications: number;
  totalMessages: number;
  broadcastMessages: number;
  totalProviders: number;
  activeProviders: number;
  totalPlays: number;
  playsThisWeek: number;
}

interface RecentMessage {
  id: number;
  sender_name: string | null;
  recipient_id: string | null;
  recipient_name: string | null;
  subject: string | null;
  body: string;
  type: string;
  created_at: string;
}

interface RecentPlay {
  id?: string;
  mediaId?: number;
  mediaType?: string;
  title?: string;
  userId?: string;
  eventType?: string;
  createdAt?: string;
  [key: string]: any;
}

interface RecentUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: string;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();

      if (data.success) {
        setStats(data.stats);
        setRecentMessages(data.recentMessages || []);
        setRecentPlays(data.recentPlays || []);
        setRecentUsers(data.recentUsers || []);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // === Stat cards config ===
  const statCards = stats
    ? [
        {
          label: "Total Users",
          value: stats.totalUsers,
          sub: `+${stats.recentUsers} this week`,
          icon: Users,
          color: "text-blue-400",
          bg: "bg-blue-500/10",
        },
        {
          label: "Watchlist Items",
          value: stats.totalWatchlist,
          sub: "saved by users",
          icon: Bookmark,
          color: "text-purple-400",
          bg: "bg-purple-500/10",
        },
        {
          label: "Watch History",
          value: stats.totalHistory,
          sub: "total plays tracked",
          icon: History,
          color: "text-cyan-400",
          bg: "bg-cyan-500/10",
        },
        {
          label: "Ratings",
          value: stats.totalRatings,
          sub: "user ratings",
          icon: Star,
          color: "text-yellow-400",
          bg: "bg-yellow-500/10",
        },
        {
          label: "Comments",
          value: stats.totalComments,
          sub: "user comments",
          icon: MessageSquare,
          color: "text-green-400",
          bg: "bg-green-500/10",
        },
        {
          label: "Notifications",
          value: stats.totalNotifications,
          sub: "old system",
          icon: Bell,
          color: "text-orange-400",
          bg: "bg-orange-500/10",
        },
        {
          label: "Admin Messages",
          value: stats.totalMessages,
          sub: `${stats.broadcastMessages} broadcasts`,
          icon: Mail,
          color: "text-pink-400",
          bg: "bg-pink-500/10",
        },
        {
          label: "Providers",
          value: `${stats.activeProviders}/${stats.totalProviders}`,
          sub: "active servers",
          icon: Server,
          color: "text-indigo-400",
          bg: "bg-indigo-500/10",
        },
        {
          label: "Total Plays",
          value: stats.totalPlays,
          sub: `${stats.playsThisWeek} this week`,
          icon: Play,
          color: "text-red-400",
          bg: "bg-red-500/10",
        },
        {
          label: "Recent Signups",
          value: stats.recentUsers,
          sub: "last 7 days",
          icon: UserPlus,
          color: "text-emerald-400",
          bg: "bg-emerald-500/10",
        },
        {
          label: "Plays This Week",
          value: stats.playsThisWeek,
          sub: "active streaming",
          icon: TrendingUp,
          color: "text-teal-400",
          bg: "bg-teal-500/10",
        },
        {
          label: "System Status",
          value: "Online",
          sub: "all systems operational",
          icon: LayoutDashboard,
          color: "text-green-400",
          bg: "bg-green-500/10",
        },
      ]
    : [];

  // === Quick actions ===
  const quickActions = [
    { label: "Add Provider", href: "/admin/providers", icon: Server, color: "text-indigo-400" },
    { label: "Send Message", href: "/admin/messages", icon: Megaphone, color: "text-pink-400" },
    { label: "View Users", href: "/admin/users", icon: Users, color: "text-blue-400" },
    { label: "Analytics", href: "/admin/analytics", icon: TrendingUp, color: "text-teal-400" },
  ];

  // === Loading state ===
  if (loading && !stats) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // === Error state ===
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-500">
        <AlertCircle className="h-5 w-5" />
        <span>{error}</span>
        <Button size="sm" variant="outline" onClick={fetchStats} className="ml-auto">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* === Header === */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Overview of your streaming platform
            {lastUpdated && (
              <span className="ml-2">· Updated {formatRelativeTime(lastUpdated.toISOString())}</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* === Quick Actions === */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <a
              key={action.href}
              href={action.href}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
            >
              <Icon className={cn("h-5 w-5", action.color)} />
              <span className="text-sm font-medium">{action.label}</span>
            </a>
          );
        })}
      </div>

      {/* === Stat Cards Grid === */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Statistics</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Card
                key={idx}
                className="p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">
                      {card.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">
                      {card.value}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground truncate">
                      {card.sub}
                    </p>
                  </div>
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0", card.bg)}>
                    <Icon className={cn("h-4 w-4", card.color)} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* === Recent Activity (3 columns) === */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* === Recent Users === */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-400" />
              Recent Signups
            </h3>
            <a href="/admin/users" className="text-xs text-primary hover:underline">
              View all
            </a>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No users yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary shrink-0">
                    {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {u.name || "Unknown"}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {u.email}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(u.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* === Recent Messages === */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-pink-400" />
              Recent Messages
            </h3>
            <a href="/admin/messages" className="text-xs text-primary hover:underline">
              View all
            </a>
          </div>
          {recentMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No messages sent yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentMessages.map((m) => (
                <div key={m.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1 h-4",
                        m.type === "warning" && "border-yellow-500/40 text-yellow-400",
                        m.type === "announcement" && "border-purple-500/40 text-purple-400",
                        m.type === "info" && "border-blue-500/40 text-blue-400",
                        m.type === "system" && "border-gray-500/40 text-gray-400"
                      )}
                    >
                      {m.type}
                    </Badge>
                    {m.recipient_id === null && (
                      <Badge variant="outline" className="text-[9px] px-1 h-4 border-purple-500/40 text-purple-400">
                        BC
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {formatRelativeTime(m.created_at)}
                    </span>
                  </div>
                  <p className="text-xs font-medium truncate">
                    {m.subject || "(no subject)"}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {m.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* === Recent Plays === */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Play className="h-4 w-4 text-red-400" />
              Recent Plays
            </h3>
            <a href="/admin/analytics" className="text-xs text-primary hover:underline">
              View all
            </a>
          </div>
          {recentPlays.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No plays tracked yet
            </p>
          ) : (
            <div className="space-y-2">
              {recentPlays.map((p, idx) => (
                <div key={p.id || idx} className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 shrink-0">
                    <Film className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {p.title || `Media #${p.mediaId || "Unknown"}`}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {p.eventType || "play"} · {p.mediaType || "movie"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {p.createdAt ? formatRelativeTime(p.createdAt) : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
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
