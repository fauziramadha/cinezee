/**
 * src/components/admin/user-manager.tsx
 *
 * Admin UI untuk manage users.
 * - List all users with search
 * - Promote/Demote admin role
 * - Ban/Unban users
 * - Delete users
 *
 * Uses existing API:
 *   GET    /api/admin/users          - List users
 *   PATCH  /api/admin/users?id=xxx   - Update role/ban status
 *   DELETE /api/admin/users?id=xxx   - Delete user
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Trash2,
  Shield,
  ShieldCheck,
  Ban,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Users as UsersIcon,
  Mail,
  Calendar,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  banned: number | boolean;
  createdAt: string;
}

export function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<User | null>(null);

  // === Fetch users ===
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // === Get current user ID from session ===
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.id) setCurrentUser(data.user.id);
      })
      .catch(() => {});
  }, []);

  // === Promote/Demote admin ===
  const handleToggleAdmin = async (user: User) => {
    if (user.id === currentUser) {
      toast.error("You cannot modify your own role");
      return;
    }
    setActionLoading(user.id);
    try {
      const newRole = user.role === "admin" ? "user" : "admin";
      const res = await fetch(`/api/admin/users?id=${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      toast.success(
        newRole === "admin"
          ? `${user.name || user.email} promoted to admin`
          : `${user.name || user.email} demoted to user`
      );
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    } finally {
      setActionLoading(null);
    }
  };

  // === Ban/Unban ===
  const handleToggleBan = async (user: User) => {
    if (user.id === currentUser) {
      toast.error("You cannot ban yourself");
      return;
    }
    setActionLoading(user.id);
    try {
      const isBanned = user.banned === 1 || user.banned === true;
      const res = await fetch(`/api/admin/users?id=${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !isBanned }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update ban status");
      }
      toast.success(
        isBanned
          ? `${user.name || user.email} unbanned`
          : `${user.name || user.email} banned`
      );
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    } finally {
      setActionLoading(null);
    }
  };

  // === Delete user ===
  const handleDelete = async () => {
    if (!deleteDialog) return;
    const user = deleteDialog;
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
      toast.success(`${user.name || user.email} deleted`);
      setDeleteDialog(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  // === Filter users ===
  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.name?.toLowerCase().includes(q) ?? false) ||
      (u.email?.toLowerCase().includes(q) ?? false)
    );
  });

  // === Stats ===
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const bannedCount = users.filter(
    (u) => u.banned === 1 || u.banned === true
  ).length;

  return (
    <div className="space-y-6">
      {/* === Header === */}
      <div>
        <h2 className="text-2xl font-bold">Users</h2>
        <p className="text-sm text-muted-foreground">
          Manage registered users, roles, and ban status
        </p>
      </div>

      {/* === Stats Summary === */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
              <UsersIcon className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{totalUsers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Admins</p>
              <p className="text-lg font-bold">{adminCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <Ban className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Banned</p>
              <p className="text-lg font-bold">{bannedCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* === Search === */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
        />
      </div>

      {/* === Loading === */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* === Error === */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-500">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={fetchUsers} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* === Users List === */}
      {!loading && !error && (
        <div className="space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              {searchQuery ? "No users match your search" : "No users registered yet"}
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isBanned = user.banned === 1 || user.banned === true;
              const isAdmin = user.role === "admin";
              const isSelf = user.id === currentUser;
              const isLoading = actionLoading === user.id;
              const initial =
                user.name?.[0]?.toUpperCase() ||
                user.email?.[0]?.toUpperCase() ||
                "U";

              return (
                <Card
                  key={user.id}
                  className={cn(
                    "p-3 transition-opacity",
                    isBanned && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 border border-border shrink-0">
                      <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
                      <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">
                        {initial}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {user.name || "Unknown"}
                        </span>
                        {isAdmin && (
                          <Badge variant="outline" className="border-purple-500/40 text-purple-400 text-[9px] px-1 h-4">
                            <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
                            ADMIN
                          </Badge>
                        )}
                        {isBanned && (
                          <Badge variant="outline" className="border-red-500/40 text-red-400 text-[9px] px-1 h-4">
                            <Ban className="h-2.5 w-2.5 mr-0.5" />
                            BANNED
                          </Badge>
                        )}
                        {isSelf && (
                          <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-[9px] px-1 h-4">
                            YOU
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {user.email || "No email"}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Calendar className="h-3 w-3" />
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString()
                            : "Unknown"}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          {/* Toggle Admin */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleToggleAdmin(user)}
                            disabled={isSelf}
                            title={isAdmin ? "Demote to user" : "Promote to admin"}
                          >
                            {isAdmin ? (
                              <ShieldCheck className="h-4 w-4 text-purple-400" />
                            ) : (
                              <Shield className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>

                          {/* Toggle Ban */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleToggleBan(user)}
                            disabled={isSelf}
                            title={isBanned ? "Unban user" : "Ban user"}
                          >
                            {isBanned ? (
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            ) : (
                              <Ban className="h-4 w-4 text-orange-400" />
                            )}
                          </Button>

                          {/* Delete */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => setDeleteDialog(user)}
                            disabled={isSelf}
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* === Delete Confirmation Dialog === */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deleteDialog?.name || deleteDialog?.email}
              </span>
              ?
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This action cannot be undone. All data associated with this user
              (watchlist, history, ratings, comments) will be permanently deleted.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(null)}
              disabled={actionLoading === deleteDialog?.id}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading === deleteDialog?.id}
            >
              {actionLoading === deleteDialog?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
