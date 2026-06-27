"use client";

import {
  Film,
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
  SheetClose,
} from "@/components/ui/sheet";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", href: "/", active: true },
  { label: "Movies", href: "/movies", active: false },
  { label: "TV Shows", href: "/tv", active: false },
  { label: "New", href: "/new", active: false },
  { label: "My List", href: "/watchlist", active: false },
];

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { data: session } = useSession();
  const setAuthModalOpen = useAppStore((s) => s.setAuthModalOpen);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-72 p-0 flex flex-col"
        style={{
          // === FIX NOTCH iOS ===
          // Tambah safe-area-inset-top di atas padding default
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* === Header dengan close button === */}
        <SheetHeader className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <Film className="h-5 w-5 text-primary-foreground" />
              </div>
              <span>
                Cine<span className="text-primary">Stream</span>
              </span>
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* === Nav Items (scrollable) === */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "rounded-md px-4 py-2.5 text-left text-sm font-medium transition-colors",
                  item.active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* === Auth Section === */}
          <div className="mt-4 border-t border-border pt-4">
            {session?.user ? (
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
            ) : (
              <Button
                onClick={() => {
                  onOpenChange(false);
                  setAuthModalOpen(true);
                }}
                className="w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <LogIn className="h-4 w-4" />
                Login / Register
              </Button>
            )}
          </div>
        </nav>

        {/* === Footer === */}
        <div className="px-4 py-4 border-t border-border space-y-3">
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
  );
}
