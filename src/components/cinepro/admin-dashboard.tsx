"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  X,
  Users,
  UserPlus,
  Bookmark,
  History,
  Star,
  MessageSquare,
  Bell,
  Shield,
  ShieldCheck,
  Ban,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Stats {
  totalUsers: number;
  recentUsers: number;
  totalWatchlist: number;
  totalHistory: number;
  totalRatings: number;
  totalComments: number;
  totalNotifications: number;
}

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  banned: number | boolean;
  createdAt: string;
}

export function AdminDashboard() {
  const { adminDashboardOpen, setAdminDashboardOpen } = useAppStore();
  const { data: session } = useSession();
  
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/users"),
      ]);
      
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      
      if (statsData.success) setStats(statsData.stats);
      if (usersData.success) setUsers(usersData.users);
    } catch {
      toast.error("Gagal memuat data admin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminDashboardOpen) {
      fetchData();
    }
  }, [adminDashboardOpen]);

  const handleAction = async (userId: string, action: "role" | "ban" | "delete") => {
    setActionLoading(userId);
    
    try {
      if (action === "delete") {
        const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
        if (res.ok) {
          toast.success("User dihapus");
          setUsers(prev => prev.filter(u => u.id !== userId));
        }
      } else {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        
        const body: any = {};
        if (action === "role") {
          body.role = user.role === "admin" ? "user" : "admin";
        } else if (action === "ban") {
          body.banned = !user.banned;
        }
        
        const res = await fetch(`/api/admin/users?id=${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        
        if (res.ok) {
          toast.success("User updated");
          setUsers(prev => prev.map(u => 
            u.id === userId 
              ? { ...u, ...body, banned: body.banned !== undefined ? (body.banned ? 1 : 0) : u.banned }
              : u
          ));
        }
      }
    } catch {
      toast.error("Gagal melakukan aksi");
    } finally {
      setActionLoading(null);
    }
  };

  const statsCards = [
    { label: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-400" },
    { label: "New (7 days)", value: stats?.recentUsers || 0, icon: UserPlus, color: "text-green-400" },
    { label: "Watchlist", value: stats?.totalWatchlist || 0, icon: Bookmark, color: "text-purple-400" },
    { label: "History", value: stats?.totalHistory || 0, icon: History, color: "text-cyan-400" },
    { label: "Ratings", value: stats?.totalRatings || 0, icon: Star, color: "text-yellow-400" },
    { label: "Comments", value: stats?.totalComments || 0, icon: MessageSquare, color: "text-pink-400" },
    { label: "Notifications", value: stats?.totalNotifications || 0, icon: Bell, color: "text-red-400" },
  ];

  return (
    <Dialog open={adminDashboardOpen} onOpenChange={setAdminDashboardOpen}>
      <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-hidden p-0 sm:max-w-4xl md:max-w-5xl lg:max-w-6xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Admin Dashboard</DialogTitle>
        </DialogHeader>
        
        <button
          onClick={() => setAdminDashboardOpen(false)}
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <ScrollArea className="max-h-[95vh]">
          {loading ? (
            <div className="flex h-96 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="fade-in p-4 sm:p-6 md:p-8">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-bold sm:text-2xl">
                <Shield className="h-6 w-6 text-primary" />
                Admin Dashboard
              </h2>

              {/* Stats Grid */}
              <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                {statsCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="rounded-lg border border-border bg-card/50 p-3"
                    >
                      <Icon className={cn("mb-2 h-5 w-5", card.color)} />
                      <p className="text-xl font-bold">{card.value}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {card.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Users Table */}
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Users className="h-5 w-5" />
                Manage Users ({users.length})
              </h3>
              
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">User</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Email</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Role</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((user) => {
                      const isSelf = user.id === session?.user?.id;
                      const isBanned = !!user.banned;
                      
                      return (
                        <tr key={user.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={user.image || undefined} />
                                <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                                  {user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase() || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium sm:text-sm">
                                {user.name || "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {user.email}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                              user.role === "admin" 
                                ? "bg-primary/20 text-primary" 
                                : "bg-muted text-muted-foreground"
                            )}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isBanned ? (
                              <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-destructive">
                                Banned
                              </span>
                            ) : (
                              <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-green-500">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {actionLoading === user.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : isSelf ? (
                                <span className="text-[9px] text-muted-foreground">You</span>
                              ) : (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleAction(user.id, "role")}
                                    title={user.role === "admin" ? "Demote to User" : "Promote to Admin"}
                                  >
                                    {user.role === "admin" ? (
                                      <Shield className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleAction(user.id, "ban")}
                                    title={isBanned ? "Unban User" : "Ban User"}
                                  >
                                    <Ban className={cn("h-3.5 w-3.5", isBanned ? "text-green-500" : "text-yellow-500")} />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive"
                                    onClick={() => handleAction(user.id, "delete")}
                                    title="Delete User"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
