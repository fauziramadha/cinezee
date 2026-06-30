"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, Power, X, Save, Loader2, AlertCircle, Megaphone, MousePointerClick, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdBanner {
  id: number;
  name: string;
  image_url: string;
  click_url: string;
  position: string;
  is_active: number;
  impressions: number;
  clicks: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

const POSITIONS = [
  { value: "home_top", label: "Homepage Top" },
  { value: "home_middle", label: "Homepage Middle" },
  { value: "search_top", label: "Search Page Top" },
];

const EMPTY_FORM = {
  name: "", image_url: "", click_url: "", position: "home_top",
  is_active: 1, start_date: "", end_date: "",
};

export function AdManager() {
  const [ads, setAds] = useState<AdBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ads");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAds(data.ads || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const handleAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const handleEdit = (ad: AdBanner) => {
    setEditingId(ad.id);
    setForm({
      name: ad.name, image_url: ad.image_url, click_url: ad.click_url,
      position: ad.position, is_active: ad.is_active,
      start_date: ad.start_date?.split(" ")[0] || "",
      end_date: ad.end_date?.split(" ")[0] || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.image_url || !form.click_url) {
      toast.error("Name, Image URL, and Click URL are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, is_active: form.is_active ? true : false };
      const url = editingId ? `/api/admin/ads/${editingId}` : "/api/admin/ads";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      
      toast.success(editingId ? "Ad updated" : "Ad created");
      setIsDialogOpen(false);
      fetchAds();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this ad?")) return;
    try {
      await fetch(`/api/admin/ads/${id}`, { method: "DELETE" });
      toast.success("Ad deleted");
      fetchAds();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleToggle = async (ad: AdBanner) => {
    try {
      await fetch(`/api/admin/ads/${ad.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ad, is_active: ad.is_active ? false : true }),
      });
      fetchAds();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Ad Management</h2>
          <p className="text-sm text-muted-foreground">Manage banner ads shown across the site.</p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Add Ad
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-500">
          <AlertCircle className="h-5 w-5" /> <span>{error}</span>
        </div>
      ) : ads.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No ads yet. Click "Add Ad" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <Card key={ad.id} className={cn("p-4", ad.is_active === 0 && "opacity-60")}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={ad.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Megaphone className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{ad.name}</h3>
                    {ad.is_active ? (
                      <Badge variant="outline" className="border-green-500/40 text-green-400">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">Disabled</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {ad.impressions} views
                    </span>
                    <span className="flex items-center gap-1">
                      <MousePointerClick className="h-3 w-3" /> {ad.clicks} clicks
                    </span>
                    <span className="capitalize">Pos: {ad.position.replace("_", " ")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleToggle(ad)} title={ad.is_active ? "Disable" : "Enable"}>
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(ad)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleDelete(ad.id)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Add/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Ad" : "Add New Ad"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Ad Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Summer Promo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL</Label>
              <Input id="image_url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://example.com/banner.jpg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="click_url">Click URL (Target Link)</Label>
              <Input id="click_url" value={form.click_url} onChange={(e) => setForm({ ...form, click_url: e.target.value })} placeholder="https://target-site.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={String(form.is_active)} onValueChange={(v) => setForm({ ...form, is_active: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Active</SelectItem>
                    <SelectItem value="0">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date (Optional)</Label>
                <Input id="start_date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date (Optional)</Label>
                <Input id="end_date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
