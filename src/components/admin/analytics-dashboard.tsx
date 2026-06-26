/**
 * src/components/admin/analytics-dashboard.tsx
 *
 * Admin Analytics UI:
 * - Range selector (7/14/30/90 days)
 * - Overview stat cards
 * - Daily plays chart (SVG line chart)
 * - Hourly plays chart (CSS bar chart)
 * - Top movies & TV list
 * - Top active users
 * - Media type breakdown
 * - Recent activity feed
 *
 * No external chart library — pure SVG + CSS (mobile-friendly, no install).
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  Play,
  Users,
  Film,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Activity,
  Tv,
  Movie,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Overview {
  totalPlays: number;
  playsInRange: number;
  uniqueViewers: number;
  uniqueMedia: number;
}

interface DailyPlay {
  date: string;
  count: number;
}

interface HourlyPlay {
  hour: number;
  count: number;
}

interface TopContent {
  mediaId: number;
  title: string;
  count: number;
}

interface TopUser {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  count: number;
}

interface RecentActivity {
  id: string;
  mediaId: number;
  mediaType: string;
  title: string;
  userId: string;
  eventType: string;
  createdAt: string;
}

interface AnalyticsData {
  success: boolean;
  range: number;
  overview: Overview;
  charts: {
    daily: DailyPlay[];
    hourly: HourlyPlay[];
  };
  topContent: {
    movies: TopContent[];
    tv: TopContent[];
  };
  mediaTypeBreakdown: {
    movie: number;
    tv: number;
  };
  topUsers: TopUser[];
  eventTypes: Array<{ eventType: string; count: number }>;
  recentActivity: RecentActivity[];
}

const RANGES = [
  { value: 7, label: "7D" },
  { value: 14, label: "14D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
];

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(7);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?range=${range}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.error || "Unknown error");
      }
    } catch (e: any) {
      setError(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === Loading state ===
  if (loading && !data) {
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
        <Button size="sm" variant="outline" onClick={fetchData} className="ml-auto">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { overview, charts, topContent, mediaTypeBreakdown, topUsers, recentActivity } = data;

  // Max values for chart scaling
  const maxDaily = Math.max(...charts.daily.map((d) => d.count), 1);
  const maxHourly = Math.max(...charts.hourly.map((h) => h.count), 1);
  const maxMovie = Math.max(...topContent.movies.map((m) => m.count), 1);
  const maxTV = Math.max(...topContent.tv.map((t) => t.count), 1);
  const maxUser = Math.max(...topUsers.map((u) => u.count), 1);

  // Build SVG line chart path for daily plays
  const dailyWidth = 100;
  const dailyHeight = 30;
  const dailyPoints = charts.daily
    .map((d, i) => {
      const x = (i / (charts.daily.length - 1)) * dailyWidth;
      const y = dailyHeight - (d.count / maxDaily) * dailyHeight;
      return `${x},${y}`;
    })
    .join(" ");

  // Stat cards
  const statCards = [
    {
      label: "Total Plays",
      value: overview.totalPlays,
      sub: "all time",
      icon: Play,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Plays in Range",
      value: overview.playsInRange,
      sub: `last ${range} days`,
      icon: TrendingUp,
      color: "text-teal-400",
      bg: "bg-teal-500/10",
    },
    {
      label: "Unique Viewers",
      value: overview.uniqueViewers,
      sub: `last ${range} days`,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Unique Media",
      value: overview.uniqueMedia,
      sub: "different titles",
      icon: Film,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* === Header === */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Track plays, engagement, and content performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  range === r.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* === Overview Stat Cards === */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{card.value}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground truncate">{card.sub}</p>
                </div>
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0", card.bg)}>
                  <Icon className={cn("h-4 w-4", card.color)} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* === Charts Section === */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* === Daily Plays Line Chart === */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-400" />
              Daily Plays
            </h3>
            <span className="text-xs text-muted-foreground">Last {range} days</span>
          </div>
          {charts.daily.every((d) => d.count === 0) ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No data for this period
            </div>
          ) : (
            <div className="space-y-2">
              {/* SVG Line Chart */}
              <svg
                viewBox={`0 0 ${dailyWidth} ${dailyHeight}`}
                preserveAspectRatio="none"
                className="w-full h-32"
              >
                {/* Area fill */}
                <polygon
                  points={`0,${dailyHeight} ${dailyPoints} ${dailyWidth},${dailyHeight}`}
                  fill="url(#dailyGradient)"
                  fillOpacity={0.3}
                />
                {/* Line */}
                <polyline
                  points={dailyPoints}
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth={0.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                {/* Gradient def */}
                <defs>
                  <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </svg>
              {/* X-axis labels (first, middle, last) */}
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{charts.daily[0]?.date.slice(5) || ""}</span>
                <span>{charts.daily[Math.floor(charts.daily.length / 2)]?.date.slice(5) || ""}</span>
                <span>{charts.daily[charts.daily.length - 1]?.date.slice(5) || ""}</span>
              </div>
            </div>
          )}
        </Card>

        {/* === Hourly Plays Bar Chart === */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-400" />
              Hourly Plays
            </h3>
            <span className="text-xs text-muted-foreground">Last 24 hours</span>
          </div>
          {charts.hourly.every((h) => h.count === 0) ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No data for last 24 hours
            </div>
          ) : (
            <div className="space-y-2">
              {/* Bars */}
              <div className="flex items-end gap-px h-32">
                {charts.hourly.map((h) => (
                  <div
                    key={h.hour}
                    className="flex-1 bg-purple-500/60 hover:bg-purple-500 transition-colors rounded-t-sm"
                    style={{
                      height: `${(h.count / maxHourly) * 100}%`,
                      minHeight: h.count > 0 ? "2px" : "0",
                    }}
                    title={`${h.hour}:00 - ${h.count} plays`}
                  />
                ))}
              </div>
              {/* X-axis labels */}
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* === Top Content Section === */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* === Top Movies === */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Movie className="h-4 w-4 text-red-400" />
              Top Movies
            </h3>
            <Badge variant="outline" className="text-[10px]">
              {topContent.movies.length} titles
            </Badge>
          </div>
          {topContent.movies.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No movie plays yet</p>
          ) : (
            <div className="space-y-2">
              {topContent.movies.slice(0, 5).map((m, idx) => (
                <div key={m.mediaId} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{m.title || `Movie #${m.mediaId}`}</p>
                    <div className="mt-0.5 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${(m.count / maxMovie) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">
                    {m.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* === Top TV Shows === */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Tv className="h-4 w-4 text-blue-400" />
              Top TV Shows
            </h3>
            <Badge variant="outline" className="text-[10px]">
              {topContent.tv.length} titles
            </Badge>
          </div>
          {topContent.tv.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No TV plays yet</p>
          ) : (
            <div className="space-y-2">
              {topContent.tv.slice(0, 5).map((t, idx) => (
                <div key={t.mediaId} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{t.title || `TV #${t.mediaId}`}</p>
                    <div className="mt-0.5 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(t.count / maxTV) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* === Top Users + Media Breakdown === */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* === Top Active Users === */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              Top Active Users
            </h3>
            <span className="text-xs text-muted-foreground">Last {range} days</span>
          </div>
          {topUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No active users yet</p>
          ) : (
            <div className="space-y-2">
              {topUsers.slice(0, 5).map((u, idx) => (
                <div key={u.userId} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                    #{idx + 1}
                  </span>
                  <Avatar className="h-7 w-7 border border-border shrink-0">
                    <AvatarImage src={u.image || undefined} alt={u.name || "User"} />
                    <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
                      {u.name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">
                      {u.name || "Unknown"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="w-16 shrink-0">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${(u.count / maxUser) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground shrink-0 w-6 text-right">
                    {u.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* === Media Type Breakdown === */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-400" />
              Media Type Breakdown
            </h3>
            <span className="text-xs text-muted-foreground">Last {range} days</span>
          </div>
          {(() => {
            const total = mediaTypeBreakdown.movie + mediaTypeBreakdown.tv;
            const moviePct = total > 0 ? (mediaTypeBreakdown.movie / total) * 100 : 0;
            const tvPct = total > 0 ? (mediaTypeBreakdown.tv / total) * 100 : 0;

            if (total === 0) {
              return (
                <p className="text-xs text-muted-foreground text-center py-8">No plays yet</p>
              );
            }

            return (
              <div className="space-y-4">
                {/* Stacked progress bar */}
                <div className="h-6 rounded-full overflow-hidden flex bg-muted">
                  <div
                    className="bg-red-500 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ width: `${moviePct}%` }}
                  >
                    {moviePct > 15 && `${Math.round(moviePct)}%`}
                  </div>
                  <div
                    className="bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ width: `${tvPct}%` }}
                  >
                    {tvPct > 15 && `${Math.round(tvPct)}%`}
                  </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">Movies</p>
                      <p className="text-[10px] text-muted-foreground">
                        {mediaTypeBreakdown.movie} plays
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">TV Shows</p>
                      <p className="text-[10px] text-muted-foreground">
                        {mediaTypeBreakdown.tv} plays
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>

      {/* === Recent Activity === */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-400" />
            Recent Activity
          </h3>
          <span className="text-xs text-muted-foreground">Last 10 plays</span>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((a, idx) => (
              <div
                key={a.id || idx}
                className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-0"
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full shrink-0",
                    a.mediaType === "movie" ? "bg-red-500/10" : "bg-blue-500/10"
                  )}
                >
                  {a.mediaType === "movie" ? (
                    <Movie className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <Tv className="h-3.5 w-3.5 text-blue-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">
                    {a.title || `Media #${a.mediaId}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {a.eventType || "play"} · {a.mediaType}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatRelativeTime(a.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
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
