/**
 * src/components/pwa/install-prompt.tsx
 *
 * Banner "Install App" yang muncul saat:
 * 1. Browser trigger event `beforeinstallprompt`
 * 2. User belum pernah dismiss/install
 * 3. Setelah 30 detik di halaman (jangan ganggu langsung)
 *
 * Dismiss disimpan di localStorage agar tidak muncul lagi selama 7 hari.
 *
 * Cara pakai:
 *   import { InstallPrompt } from "@/components/pwa/install-prompt";
 *   <InstallPrompt />  // taruh di root layout atau home page
 */

"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "cinestream_install_dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 hari

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  // === Cek apakah user sudah dismiss sebelumnya ===
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        // Masih dalam periode dismiss, jangan tampilkan
        return;
      }
      // Sudah lebih dari 7 hari, hapus dismiss
      localStorage.removeItem(DISMISS_KEY);
    }

    // === Listener untuk beforeinstallprompt ===
    const handleBeforeInstallPrompt = (e: Event) => {
      // Cegah browser show prompt default
      e.preventDefault();
      // Simpan event untuk dipakai nanti
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Tampilkan banner setelah 30 detik (jangan ganggu langsung)
      setTimeout(() => {
        setShow(true);
      }, 30000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // === Listener untuk appinstalled ===
    const handleAppInstalled = () => {
      console.log("[PWA] App installed successfully");
      setShow(false);
      setDeferredPrompt(null);
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // === Handle install button ===
  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Tampilkan install prompt browser
    await deferredPrompt.prompt();

    // Tunggu user choice
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      console.log("[PWA] User accepted install");
    } else {
      console.log("[PWA] User dismissed install");
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }

    // Reset state
    setDeferredPrompt(null);
    setShow(false);
  };

  // === Handle dismiss ===
  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  // === Jangan render kalau tidak show ===
  if (!show || !deferredPrompt) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "16px",
        right: "16px",
        zIndex: 9999,
        maxWidth: "400px",
        margin: "0 auto",
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      <div
        style={{
          background: "linear-gradient(135deg, #B20710 0%, #8B0000 100%)",
          borderRadius: "16px",
          padding: "16px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
          color: "white",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "44px",
            height: "44px",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Smartphone style={{ width: "22px", height: "22px" }} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
            Install CineStream
          </p>
          <p style={{ fontSize: "12px", opacity: 0.9, margin: "2px 0 0 0" }}>
            Akses cepat dari home screen + tonton offline
          </p>
        </div>

        {/* Install button */}
        <Button
          onClick={handleInstall}
          size="sm"
          style={{
            background: "white",
            color: "#B20710",
            border: "none",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          <Download style={{ width: "14px", height: "14px", marginRight: "4px" }} />
          Install
        </Button>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: "4px",
            opacity: 0.8,
            flexShrink: 0,
          }}
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>
      </div>
    </div>
  );
}
