"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Search,
  Film,
  Menu,
  X,
  Github,
  Heart,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAppStore } from "@/lib/store";
import { UserMenu } from "@/components/cinepro/user-menu";
import { UserMessages } from "@/components/user-messages";
import { cn } from "@/lib/utils";

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

  const navItems = [
    { label: "Home", active: true },
    { label: "Movies", active: false },
    { label: "TV Shows", active: false },
    { label: "New", active: false },
    { label: "My List", active: false },
  ];

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "glass border-b border-border/40"
          : "bg-gradient-to-b from-black/80 to-transparent",
      )}
      style={{
        // === FIX NOTCH iOS ===
        // Beri padding otomatis sesuai ukuran notch/dynamic island iPhone
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="mx-auto flex min-h-[64px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Film className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Cine<span className="text-primary">Stream</span>
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <button
                key={item.label}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  item.active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Search + Auth + Mobile menu */}
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

          {/* Message Bell (only if logged in) */}
          {status === "authenticated" && session?.user && (
            <UserMessages />
          )}

          {/* Auth: UserMenu (if logged in) OR Login button (if not logged in) */}
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

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                    <Film className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span>
                    Cine<span className="text-primary">Stream</span>
                  </span>
                </SheetTitle>
              </SheetHeader>

              <nav className="mt-8 flex flex-col gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "rounded-md px-4 py-2.5 text-left text-sm font-medium transition-colors",
                      item.active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Auth section in mobile menu */}
              <div className="mt-4 border-t border-border pt-4">
                {session?.user ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 px-4 py-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                        {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {session.user.name || "User"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {session.user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setMobileOpen(false);
                      setAuthModalOpen(true);
                    }}
                    className="w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <LogIn className="h-4 w-4" />
                    Login / Register
                  </Button>
                )}
              </div>

              <div className="absolute bottom-6 left-6 right-6 space-y-3">
                <a
                  href="https://github.com/cinepro-org/ui"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Github className="h-3.5 w-3.5" />
                  Inspired by CinePro UI
                </a>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  Made with <Heart className="h-3 w-3 fill-primary text-primary" /> for streaming
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
