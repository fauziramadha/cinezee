"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, Settings, ChevronDown, Loader2, Bookmark, History } from "lucide-react";
import { toast } from "sonner";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Don't render anything if loading or not authenticated
  if (status === "loading") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return null;
  }

  const user = session.user;
  const initial = user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

  const handleLogout = async () => {
    setMenuOpen(false);
    toast.loading("Logging out...");
    await signOut({ redirect: false });
    toast.success("Berhasil logout. Sampai jumpa lagi!");
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* User button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 rounded-full p-1 pr-2 transition-colors hover:bg-muted"
        aria-label="User menu"
        aria-expanded={menuOpen}
      >
        <Avatar className="h-7 w-7 border border-border">
          <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
          <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
            {initial}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-xl z-50">
          {/* User info header */}
          <div className="flex items-center gap-3 border-b border-border p-3">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
              <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.name || "User"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1">
            <button
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              Profil Saya
            </button>
            <button
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              Watchlist
            </button>
            <button
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <History className="h-4 w-4 text-muted-foreground" />
              Riwayat Tonton
            </button>
            
            {/* Admin only */}
            {user.role === "admin" && (
              <button
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Admin Dashboard
              </button>
            )}
          </div>

          {/* Logout button */}
          <div className="border-t border-border p-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
