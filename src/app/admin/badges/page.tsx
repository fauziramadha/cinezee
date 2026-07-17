"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Loader2, Shield, X, Search, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Badge {
  id: number;
  name: string;
  color: string;
  icon: string;
}

interface UserBadge extends Badge {
  equipped: boolean;
  expires_at: string | null;
}

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export default function AdminBadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  
  const [searchUserId, setSearchUserId] = useState("");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [searching, setSearching] = useState(false);

  const [expiryDate, setExpiryDate] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("admin_api_key");
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem("admin_api_key", apiKey);
      fetchBadges();
    }
  }, [apiKey]);

  const fetchBadges = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/badges");
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || []);
      }
    } catch {}
    setLoading(false);
  };

  const handleSearchUser = async () => {
    if (!searchUserId.trim()) return;
    setSearching(true);
    setUserInfo(null);
    setUserBadges([]);
    try {
      const res = await fetch(`/api/user/${searchUserId}/badges`, {
        headers: { "X-Admin-API-Key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setUserInfo(data.user);
        setUserBadges(data.badges || []);
      } else {
        toast.error("User tidak ditemukan");
      }
    } catch {
      toast.error("Gagal mencari user");
    }
    setSearching(false);
  };

  const handleAssign = async (badgeId: number) => {
    try {
      const res = await fetch("/api/badges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-API-Key": apiKey,
        },
        body: JSON.stringify({ 
          userId: searchUserId, 
          badgeId,
          expiresAt: expiryDate ? new Date(expiryDate).toISOString() : null
        }),
      });
      if (res.ok) {
        toast.success("Badge berhasil diberikan");
        handleSearchUser(); // Refresh
      }
    } catch {}
  };

  const handleRevoke = async (badgeId: number) => {
    try {
      const res = await fetch("/api/badges", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-API-Key": apiKey,
        },
        body: JSON.stringify({ userId: searchUserId, badgeId }),
      });
      if (res.ok) {
        toast.success("Badge dicabut");
        handleSearchUser(); // Refresh
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Badge Management</h1>
          <p className="text-sm text-muted-foreground">Berikan dan kelola badge pengguna</p>
        </div>

        {!apiKey ? (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
            <Label className="text-sm font-semibold">Admin API Key</Label>
            <Input
              type="password"
              placeholder="Paste your ADMIN_API_KEY"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1"
            />
          </div>
        ) : (
          <>
            {/* Search User */}
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <h2 className="text-lg font-semibold">Cari User</h2>
              <div className="flex gap-2">
                <Input
                  placeholder="Masukkan User ID"
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                />
                <Button onClick={handleSearchUser} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* User Info & Badges */}
            {userInfo && (
              <div className="space-y-4 rounded-lg border bg-card p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">
                    {userInfo.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <h3 className="font-semibold">{userInfo.name || "No Name"}</h3>
                    <p className="text-sm text-muted-foreground">{userInfo.email}</p>
                  </div>
                </div>

                {/* User's Current Badges */}
                {userBadges.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Badge Aktif</p>
                    <div className="flex flex-wrap gap-2">
                      {userBadges.map((badge) => (
                        <div key={badge.id} className="flex items-center gap-2 rounded-md border p-2">
                          <span style={{ color: badge.color }}>{badge.icon}</span>
                          <span className="text-sm font-medium">{badge.name}</span>
                          {badge.equipped && <UIBadge className="text-[10px]">Equipped</UIBadge>}
                          {badge.expires_at && (
                            <span className="text-[10px] text-muted-foreground">
                              until {new Date(badge.expires_at).toLocaleDateString()}
                            </span>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleRevoke(badge.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assign New Badge */}
            {userInfo && (
              <div className="space-y-4 rounded-lg border bg-card p-4">
                <h2 className="text-lg font-semibold">Beri Badge Baru</h2>
                
                <div>
                  <Label htmlFor="expiry" className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Masa Aktif (Opsional)
                  </Label>
                  <Input
                    id="expiry"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="mt-1 w-full sm:w-auto"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Kosongkan jika badge permanen.</p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {badges.map((badge) => (
                    <div key={badge.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl" style={{ color: badge.color }}>{badge.icon}</span>
                        <div>
                          <p className="text-sm font-medium">{badge.name}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleAssign(badge.id)}>
                        <Shield className="h-3 w-3 mr-1" /> Assign
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
