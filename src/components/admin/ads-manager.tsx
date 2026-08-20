"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Check, Film, Link, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdsConfig {
  id: number;
  pre_roll_enabled: number;
  hilltopads_preroll_url: string | null;
  hilltopads_preroll_duration: number;
  hilltopads_preroll_skip_delay: number;
  monetag_popunder_url: string | null;
  monetag_popunder_enabled: number;
  adsterra_direct_link: string | null;
  adsterra_enabled: number;
  updated_at: string;
}

export function AdsManager() {
  const [config, setConfig] = useState<AdsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    pre_roll_enabled: false,
    hilltopads_preroll_url: "",
    hilltopads_preroll_duration: 15,
    hilltopads_preroll_skip_delay: 5,
    monetag_popunder_url: "",
    monetag_popunder_enabled: false,
    adsterra_direct_link: "",
    adsterra_enabled: false,
  });

  useEffect(() => {
    fetch("/api/admin/ads")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          setConfig(data.config);
          setForm({
            pre_roll_enabled: !!data.config.pre_roll_enabled,
            hilltopads_preroll_url: data.config.hilltopads_preroll_url || "",
            hilltopads_preroll_duration:
              data.config.hilltopads_preroll_duration || 15,
            hilltopads_preroll_skip_delay:
              data.config.hilltopads_preroll_skip_delay || 5,
            monetag_popunder_url: data.config.monetag_popunder_url || "",
            monetag_popunder_enabled: !!data.config.monetag_popunder_enabled,
            adsterra_direct_link: data.config.adsterra_direct_link || "",
            adsterra_enabled: !!data.config.adsterra_enabled,
          });
        }
      })
      .catch(() => toast.error("Gagal memuat config"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pre_roll_enabled: form.pre_roll_enabled ? 1 : 0,
          hilltopads_preroll_url: form.hilltopads_preroll_url || null,
          hilltopads_preroll_duration: Number(form.hilltopads_preroll_duration),
          hilltopads_preroll_skip_delay: Number(form.hilltopads_preroll_skip_delay),
          monetag_popunder_url: form.monetag_popunder_url || null,
          monetag_popunder_enabled: form.monetag_popunder_enabled ? 1 : 0,
          adsterra_direct_link: form.adsterra_direct_link || null,
          adsterra_enabled: form.adsterra_enabled ? 1 : 0,
        }),
      });

      if (res.ok) {
        toast.success("Config saved");
      } else {
        toast.error("Failed to save");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ad Management</h1>
          <p className="text-sm text-muted-foreground">
            Kelola iklan di website. Premium user tidak akan melihat iklan.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {config && (
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(config.updated_at).toLocaleString()}
        </p>
      )}

      {/* === HILLTOPADS PRE-ROLL === */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Pre-Roll Ad (HilltopAds)</h2>
          </div>
          <Toggle
            checked={form.pre_roll_enabled}
            onChange={(v) => setForm({ ...form, pre_roll_enabled: v })}
          />
        </div>

        <div
          className={cn(
            "space-y-4 transition-opacity",
            !form.pre_roll_enabled && "opacity-50 pointer-events-none"
          )}
        >
          <div>
            <Label htmlFor="preroll-url">Pre-Roll URL</Label>
            <Input
              id="preroll-url"
              type="url"
              placeholder="https://hilltopads.com/..."
              value={form.hilltopads_preroll_url}
              onChange={(e) =>
                setForm({ ...form, hilltopads_preroll_url: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              URL iframe iklan dari HilltopAds dashboard
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="preroll-duration">Duration (seconds)</Label>
              <Input
                id="preroll-duration"
                type="number"
                min="5"
                max="60"
                value={form.hilltopads_preroll_duration}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hilltopads_preroll_duration: Number(e.target.value),
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Maksimal durasi iklan (auto-close)
              </p>
            </div>

            <div>
              <Label htmlFor="preroll-skip">Skip Delay (seconds)</Label>
              <Input
                id="preroll-skip"
                type="number"
                min="0"
                max="30"
                value={form.hilltopads_preroll_skip_delay}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hilltopads_preroll_skip_delay: Number(e.target.value),
                  })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tunggu X detik sebelum bisa skip
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* === MONETAG POPUNDER === */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Popunder (Monetag)</h2>
          </div>
          <Toggle
            checked={form.monetag_popunder_enabled}
            onChange={(v) => setForm({ ...form, monetag_popunder_enabled: v })}
          />
        </div>

        <div
          className={cn(
            "space-y-4 transition-opacity",
            !form.monetag_popunder_enabled && "opacity-50 pointer-events-none"
          )}
        >
          <div>
            <Label htmlFor="monetag-url">Popunder Script URL</Label>
            <Input
              id="monetag-url"
              type="url"
              placeholder="https://monetag.com/..."
              value={form.monetag_popunder_url}
              onChange={(e) =>
                setForm({ ...form, monetag_popunder_url: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              URL script popunder dari Monetag dashboard
            </p>
          </div>
        </div>
      </div>

      {/* === ADSTERRA DIRECT LINK === */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Direct Link (Adsterra)</h2>
          </div>
          <Toggle
            checked={form.adsterra_enabled}
            onChange={(v) => setForm({ ...form, adsterra_enabled: v })}
          />
        </div>

        <div
          className={cn(
            "space-y-4 transition-opacity",
            !form.adsterra_enabled && "opacity-50 pointer-events-none"
          )}
        >
          <div>
            <Label htmlFor="adsterra-url">Direct Link URL</Label>
            <Input
              id="adsterra-url"
              type="url"
              placeholder="https://www.profitableratecpm.com/..."
              value={form.adsterra_direct_link}
              onChange={(e) =>
                setForm({ ...form, adsterra_direct_link: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Direct link dari Adsterra (untuk banner/link referral)
            </p>
          </div>
        </div>
      </div>

      {/* === INFO: PREMIUM USER === */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Check className="h-4 w-4 text-primary" />
          Premium User Behavior
        </h3>
        <p className="text-xs text-muted-foreground">
          User dengan <code className="rounded bg-muted px-1">is_premium = 1</code> di
          tabel User <strong>tidak akan melihat iklan apapun</strong>, walau semua
          toggle di atas aktif. Ini untuk dukungan versi premium tanpa iklan.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Untuk menjadikan user premium, jalankan SQL:{" "}
          <code className="rounded bg-muted px-1">
            UPDATE User SET is_premium = 1 WHERE email = "user@email.com"
          </code>
        </p>
      </div>

      {/* Save button di bawah */}
      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// === Toggle Switch Component ===
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
