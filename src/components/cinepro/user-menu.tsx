"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut,
  User as UserIcon,
  ChevronDown,
  Loader2,
  Bookmark,
  History,
  Languages,
  Check,
  LayoutDashboard,
  Server,
  Mail,
  Users,
  BarChart3,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation, setGuestLanguage } from "@/i18n/use-translation";
import type { TranslationKeys, Language } from "@/i18n/messages";

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

// === Admin menu items (dengan translations keys) ===
const ADMIN_ITEMS: { labelKey: TranslationKeys; href: string; icon: any }[] = [
  { labelKey: "admin_dashboard", href: "/admin", icon: LayoutDashboard },
  { labelKey: "admin_providers", href: "/admin/providers", icon: Server },
  { labelKey: "admin_messages", href: "/admin/messages", icon: Mail },
  { labelKey: "admin_users", href: "/admin/users", icon: Users },
  { labelKey: "admin_analytics", href: "/admin/analytics", icon: BarChart3 },
  { labelKey: "admin_logs", href: "/admin/logs", icon: ScrollText },
];

export function UserMenu() {
  const router = useRouter();

  // Safe useSession — handle undefined during SSG prerender
  const sessionResult = useSession() as any;
  const session = sessionResult?.data ?? null;
  const status = sessionResult?.status ?? "unauthenticated";

  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [langLoading, setLangLoading] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>("en");
  const menuRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // SYNC LOCAL STATE WITH SESSION/LOCALSTORAGE
  // ============================================================
  useEffect(() => {
    // Priority 1: localStorage (langsung update saat ganti bahasa)
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cinestream_language");
        if (stored) {
          setSelectedLang(stored);
          return;
        }
      } catch {}
    }

    // Priority 2: Session language
    if (session?.user?.language) {
      setSelectedLang(session.user.language);
    }
  }, [session]);

  // ============================================================
  // CLOSE MENU WHEN CLICKING OUTSIDE
  // ============================================================
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

  // ============================================================
  // LOADING STATE
  // ============================================================
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
  const currentLang = LANGUAGES.find((l) => l.code === selectedLang) || LANGUAGES[0];
  const isAdmin = user.role === "admin";

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleLogout = async () => {
    setMenuOpen(false);
    toast.loading(t("loading"));
    await signOut({ redirect: false });
    toast.success(t("logout") + " ✓");
  };

  const handleNavigate = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  };

  const handleLanguageChange = async (code: string) => {
    setLangLoading(true);

    try {
      // 1. Update localStorage + trigger event (untuk update UI real-time)
      setGuestLanguage(code as Language);

      // 2. Kalau user login, update ke database
      if (session?.user) {
        const res = await fetch("/api/user/language", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: code }),
        });

        if (!res.ok) {
          toast.error(t("error"));
          setLangLoading(false);
          return;
        }
      }

      // 3. Update state lokal
      setSelectedLang(code);
      const langName = LANGUAGES.find((l) => l.code === code)?.name || code;
      toast.success(`${t("language")}: ${langName}`);
      setLangOpen(false);

      // 4. Reload setelah delay singkat (biar toast sempat tampil)
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch {
      toast.error(t("error"));
    } finally {
      setLangLoading(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
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

      {/* ============================================================ */}
      {/* DROPDOWN MENU                                                */}
      {/* ============================================================ */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 max-h-[80vh] overflow-y-auto rounded-lg border border-border bg-popover shadow-xl z-50">
          {/* === User info header === */}
          <div className="flex items-center gap-3 border-b border-border p-3 sticky top-0 bg-popover z-10">
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

          {/* === User menu items === */}
          <div className="p-1">
            <button
              onClick={() => handleNavigate("/profile")}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              {t("profile")}
            </button>
            <button
              onClick={() => handleNavigate("/watchlist")}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              {t("watchlist")}
            </button>
            <button
              onClick={() => handleNavigate("/history")}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <History className="h-4 w-4 text-muted-foreground" />
              {t("history")}
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Languages className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">{t("language")}</span>
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
                        lang.code === selectedLang ? "bg-primary/10 text-primary" : "text-foreground"
                      }`}
                    >
                      <span className="text-sm">{lang.flag}</span>
                      <span className="flex-1 text-left">{lang.name}</span>
                      {lang.code === selectedLang && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* ADMIN SECTION (hanya untuk admin)                            */}
          {/* ============================================================ */}
          {isAdmin && (
            <>
              {/* Separator + Label */}
              <div className="border-t border-border">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {t("admin_section")}
                  </span>
                  <div className="flex-1 border-t border-dashed border-primary/20" />
                </div>
              </div>

              {/* Admin menu items */}
              <div className="p-1">
                {ADMIN_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={() => handleNavigate(item.href)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary group"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="flex-1 text-left">{t(item.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* === Logout button === */}
          <div className="border-t border-border p-1 sticky bottom-0 bg-popover">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
