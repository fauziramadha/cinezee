/**
 * src/components/admin/logs-viewer.tsx
 *
 * Admin UI untuk view system logs.
 * - Stats cards (count per level)
 * - Filter by level, category, search
 * - Pagination
 * - Clear old logs button
 * - Auto-refresh toggle
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Search,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Activity,
  Clock,
  User,
  Globe,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: number;
  level: string;
  category: string;
  message: string;
  context: string | null;
  user_id: string | null;
  user_agent: string | null;
  ip_address: string | null;
  path: string | null;
  method: string | null;
  status_code: number | null;
  duration_ms: number | null;
  created_at: string;
}

interface Stats {
  level: string;
  count: number;
}

const LEVEL_META: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  error: { color: "text-red-400", bg: "bg-red-500/10", icon: AlertCircle, label: "Errors" },
  warn: { color: "text-yellow-400", bg: "bg-yellow-500/10", icon: AlertTriangle, label: "Warnings" },
  info: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Info, label: "Info" },
  debug: { color: "text-gray-400", bg: "bg-gray-500/10", icon: Bug, label: "Debug" },
};

const CATEGORIES = [
  "api", "auth", "db", "cache", "pwa",
  "provider", "message", "user", "system", "security",
];

const PAGE_SIZE = 50;

export function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  // Filters
  const [level, setLevel] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Options
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [clearDialog, setClearDialog] = useState(false);
  const [clearDays, setClearDays] = useState(30);

  // === Fetch logs ===
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (level !== "all") params.set("level", level);
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      const res = await fetch(`/api/admin/logs?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();

      if (data.success) {
        setLogs(data.logs || []);
        setStats(data.stats || []);
        setTotal(data.pagination?.total || 0);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (e: any) {
      setError(e.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [level, category, search, offset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // === Auto-refresh ===
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchLogs(), 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // === Reset offset when filter changes ===
  useEffect(() => {
    setOffset(0);
  }, [level, category, search]);

  // === Clear old logs ===
  const handleClear = async () => {
    try {
      const res = await fetch(`/api/admin/logs?olderThanDays=${clearDays}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear logs");
      const data = await res.json();
      toast.success(`Deleted ${data.deleted} logs older than ${clearDays} days`);
      setClearDialog(false);
      fetchLogs();
    } catch (e: any) {
      toast.error(e.message || "Clear failed");
    }
  };

  // === Parse context JSON ===
  const parseContext = (ctx: string | null): any => {
    if (!ctx) return null;
    try {
      return JSON.parse(ctx);
    } catch {
      return ctx;
    }
  };

  // === Stats cards ===
  const statCards = [
    { level: "error", value: stats.find((s) => s.level === "error")?.count || 0 },
    { level: "warn", value: stats.find((s) => s.level === "warn")?.count || 0 },
    { level: "info", value: stats.find((s) => s.level === "info")?.count || 0 },
    { level: "debug", value: stats.find((s) => s.level === "debug")?.count || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* === Header === */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">System Logs</h2>
          <p className="text-sm text-muted-foreground">
            Monitor errors, warnings, and system activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-2"
          >
            <Activity className={cn("h-4 w-4", autoRefresh && "animate-pulse")} />
            Auto
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClearDialog(true)}
            className="gap-2 text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* === Stats Cards === */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card) => {
          const meta = LEVEL_META[card.level];
          const Icon = meta.icon;
          return (
            <Card
              key={card.level}
              className={cn("p-4 cursor-pointer transition-all", meta.bg)}
              onClick={() => setLevel(level === card.level ? "all" : card.level)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                  <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                </div>
                <Icon className={cn("h-8 w-8", meta.color)} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* === Filters === */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger>
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="error">Errors</SelectItem>
            <SelectItem value="warn">Warnings</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search message..."
            className="pl-9"
          />
        </div>
      </div>

      {/* === Loading === */}
      {loading && logs.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-500">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No logs found
        </div>
      ) : (
        <>
          {/* === Logs List === */}
          <div className="space-y-2">
            {logs.map((log) => {
              const meta = LEVEL_META[log.level] || LEVEL_META.info;
              const Icon = meta.icon;
              const ctx = parseContext(log.context);

              return (
                <Card key={log.id} className="p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0", meta.bg)}>
                      <Icon className={cn("h-4 w-4", meta.color)} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {/* Top row: message + time */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium break-words">{log.message}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Badge
                          variant="outline"
                          className={cn("text-[9px] px-1 h-4", meta.color, "border-current")}
                        >
                          {log.level.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1 h-4">
                          {log.category}
                        </Badge>
                        {log.method && (
                          <Badge variant="outline" className="text-[9px] px-1 h-4 text-blue-400 border-blue-500/40">
                            {log.method}
                          </Badge>
                        )}
                        {log.status_code && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1 h-4",
                              log.status_code >= 500
                                ? "text-red-400 border-red-500/40"
                                : log.status_code >= 400
                                ? "text-yellow-400 border-yellow-500/40"
                                : "text-green-400 border-green-500/40"
                            )}
                          >
                            {log.status_code}
                          </Badge>
                        )}
                        {log.duration_ms !== null && (
                          <Badge variant="outline" className="text-[9px] px-1 h-4 text-muted-foreground">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            {log.duration_ms}ms
                          </Badge>
                        )}
                      </div>

                      {/* Context (expandable) */}
                      {ctx && (
                        <details className="mt-2">
                          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                            View details
                          </summary>
                          <pre className="mt-1 text-[10px] bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(ctx, null, 2)}
                          </pre>
                        </details>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
                        {log.path && (
                          <span className="flex items-center gap-1 truncate">
                            <Globe className="h-2.5 w-2.5" />
                            {log.path}
                          </span>
                        )}
                        {log.user_id && (
                          <span className="flex items-center gap-1 truncate">
                            <User className="h-2.5 w-2.5" />
                            {log.user_id.substring(0, 8)}...
                          </span>
                        )}
                        {log.ip_address && (
                          <span className="truncate">{log.ip_address}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* === Pagination === */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* === Clear Dialog === */}
      <Dialog open={clearDialog} onOpenChange={setClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Old Logs</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete logs older than the specified days.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Delete logs older than</label>
              <Select value={String(clearDays)} onValueChange={(v) => setClearDays(parseInt(v, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="0">All logs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Logs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
