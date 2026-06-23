"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, Settings, ChevronDown, Loader2, Bookmark, History, Languages, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "id", name: "Indonesia", flag: "🇮🇩" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

export function UserMenu() {
  const { data: session, status, update } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [langLoading, setLangLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const setAdminDashboardOpen = useAppStore((s) => s.setAdminDashboardOpen);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setLangOpen(false);
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
  const currentLang = LANGUAGES.find(l => l.code === user.language) || LANGUAGES[0];

  const handleLogout = async () => {
    setMenuOpen(false);
    toast.loading("Logging out...");
    await signOut({ redirect: false });
    toast.success("Berhasil logout. Sampai jumpa lagi!");
  };

  const handleOpenAdmin = () => {
    setMenuOpen(false);
    setAdminDashboardOpen(true);
  };

  const handleLanguageChange = async (code: string) => {
    setLangLoading(true);
    try {
      const res = await fetch("/api/user/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: code }),
      });

      if (res.ok) {
        // Update session locally
        await update({ ...session, user: { ...user, language: code } });
        toast.success(`Language changed to ${LANGUAGES.find(l => l.code === code)?.name}`);
        setLangOpen(false);
      } else {
        toast.error("Failed to change language");
      }
    } catch {
      toast.error("Failed to change language");
    } finally {
      setLangLoading(false);
    }
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

            {/* Language Switcher */}
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Languages className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">Language</span>
              <span className="text-xs text-muted-foreground">
                {currentLang.flag} {currentLang.code.toUpperCase()}
              </span>
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${langOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Language list */}
            {langOpen && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-background p-1 scrollbar-thin">
                {langLoading ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                ) : (
                  LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted ${
                        lang.code === currentLang.code ? "bg-primary/10 text-primary" : "text-foreground"
                      }`}
                    >
                      <span className="text-sm">{lang.flag}</span>
                      <span className="flex-1 text-left">{lang.name}</span>
                      {lang.code === currentLang.code && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
            
            {/* Admin only */}
            {user.role === "admin" && (
              <button
                onClick={handleOpenAdmin}
                className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
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
