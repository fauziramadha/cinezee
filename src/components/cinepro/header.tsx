"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Search,
  Film,
  Menu,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { UserMenu } from "@/components/cinepro/user-menu";
import { UserMessages } from "@/components/user-messages";
import { MobileSidebar } from "@/components/cinepro/mobile-sidebar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", href: "/", active: true },
  { label: "Movies", href: "/movies", active: false },
  { label: "TV Shows", href: "/tv", active: false },
  { label: "New", href: "/new", active: false },
  { label: "My List", href: "/watchlist", active: false },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session, status } = useSession();
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setAuthModalOpen = useAppStore((s) => s.setAuthModalOpen);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "glass border-b border-border/40"
          : "bg-gradient-to-b from-black/80 to-transparent",
      )}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="mx-auto flex min-h-[64px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* === Left: Logo + Desktop Nav === */}
        <div className="flex items-center gap-8">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Film className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Cine<span className="text-primary">Stream</span>
            </span>
          </a>

          {/* Desktop nav (md+) */}
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  item.active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* === Right: Search + Auth + Mobile Menu === */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchOpen(true)}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
            <span className="hidden text-sm sm:inline">Search...</span>
            <kbd className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </Button>

          {/* Message Bell */}
          {status === "authenticated" && session?.user && (
            <UserMessages />
          )}

          {/* Auth */}
          {status === "loading" ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : session?.user ? (
            <UserMenu />
          ) : (
            <Button
              size="sm"
              onClick={() => setAuthModalOpen(true)}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Button>
          )}

          {/* Mobile Menu Trigger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* === Mobile Sidebar (dipisah ke komponen sendiri) === */}
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
    </header>
  );
}
