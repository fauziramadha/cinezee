/**
 * src/components/admin/provider-manager.tsx
 *
 * Admin UI untuk manage streaming providers.
 * - List, Add, Edit, Delete, Toggle Active, Reorder
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  X,
  Save,
  GripVertical,
  Server,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ProviderConfig {
  id: number;
  name: string;
  server_label: string;
  embed_base: string;
  movie_path: string;
  tv_path: string;
  brutality: number;
  is_active: number;
  sort_order: number;
  api_key: string | null;
  api_key_param: string | null;
  debug_param: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  name: "",
  server_label: "",
  embed_base: "",
  movie_path: "",
  tv_path: "",
  brutality: 0,
  is_active: 1,
  sort_order: 0,
  api_key: "",
  api_key_param: "",
  debug_param: "",
};

export function ProviderManager() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // === Fetch providers ===
  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/providers");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // === Open Add dialog ===
  const handleAdd = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      sort_order: providers.length + 1,
    });
    setIsDialogOpen(true);
  };

  // === Open Edit dialog ===
  const handleEdit = (p: ProviderConfig) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      server_label: p.server_label,
      embed_base: p.embed_base,
      movie_path: p.movie_path,
      tv_path: p.tv_path,
      brutality: p.brutality,
      is_active: p.is_active,
      sort_order: p.sort_order,
      api_key: p.api_key || "",
      api_key_param: p.api_key_param || "",
      debug_param: p.debug_param || "",
    });
    setIsDialogOpen(true);
  };

  // === Save (create or update) ===
  const handleSave = async () => {
    if (!form.name || !form.server_label || !form.embed_base) {
      toast.error("Name, Server Label, and Embed Base are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        brutality: Number(form.brutality),
        sort_order: Number(form.sort_order),
        is_active: form.is_active === 1 || form.is_active === true,
        api_key: form.api_key || null,
        api_key_param: form.api_key_param || null,
        debug_param: form.debug_param || null,
      };

      if (editingId) {
        const res = await fetch(`/api/admin/providers/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Provider updated");
      } else {
        const res = await fetch("/api/admin/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
        toast.success("Provider added");
      }

      setIsDialogOpen(false);
      fetchProviders();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // === Delete ===
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Provider deleted");
      fetchProviders();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  };

  // === Toggle active ===
  const handleToggle = async (id: number, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", is_active: !currentActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      toast.success(currentActive ? "Provider disabled" : "Provider enabled");
      fetchProviders();
    } catch (e: any) {
      toast.error(e.message || "Toggle failed");
    }
  };

  // === Move up/down (reorder) ===
  const handleMove = async (idx: number, direction: "up" | "down") => {
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === providers.length - 1) return;

    const newProviders = [...providers];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newProviders[idx], newProviders[swapIdx]] = [
      newProviders[swapIdx],
      newProviders[idx],
    ];

    setProviders(newProviders); // optimistic update

    try {
      await fetch(`/api/admin/providers/${newProviders[0].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          orderedIds: newProviders.map((p) => p.id),
        }),
      });
    } catch (e: any) {
      toast.error("Reorder failed");
      fetchProviders();
    }
  };

  const brutalityLabel = (b: number) => {
    if (b === 0) return { label: "Clean", color: "border-green-500/40 text-green-400" };
    if (b <= 2) return { label: "Low", color: "border-yellow-500/40 text-yellow-400" };
    if (b <= 4) return { label: "Med", color: "border-orange-500/40 text-orange-400" };
    return { label: "High", color: "border-red-500/40 text-red-400" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Streaming Providers</h2>
          <p className="text-sm text-muted-foreground">
            Manage servers shown in the player. Active providers are available to users.
          </p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Server
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-500">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Providers List */}
      {!loading && !error && (
        <div className="space-y-3">
          {providers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              No providers yet. Click "Add Server" to create one.
            </div>
          ) : (
            providers.map((p, idx) => {
              const brutal = brutalityLabel(p.brutality);
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border p-4 ${
                    p.is_active
                      ? "border-border bg-card"
                      : "border-border bg-card opacity-50"
                  }`}
                >
                  {/* Drag handle (decorative) */}
                  <GripVertical className="h-5 w-5 text-muted-foreground" />

                  {/* Server icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Server className="h-5 w-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">
                        {p.server_label}
                      </span>
                      <Badge variant="outline" className={brutal.color}>
                        {brutal.label}
                      </Badge>
                      {p.is_active ? (
                        <Badge variant="outline" className="border-green-500/40 text-green-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.embed_base} / {p.movie_path} / {p.tv_path}
                      {p.api_key && <span className="ml-2 text-primary">🔑 Premium</span>}
                      {p.debug_param && <span className="ml-2 text-yellow-500">🐞 Debug</span>}
                    </div>
                  </div>

                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, "up")}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={idx === providers.length - 1}
                      onClick={() => handleMove(idx, "down")}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Actions */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleToggle(p.id, p.is_active === 1)}
                    title={p.is_active ? "Disable" : "Enable"}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(p)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(p.id, p.server_label)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Server" : "Add New Server"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Internal Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Server 9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server_label">Display Label</Label>
                <Input
                  id="server_label"
                  value={form.server_label}
                  onChange={(e) =>
                    setForm({ ...form, server_label: e.target.value })
                  }
                  placeholder="e.g. FilmU Premium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="embed_base">Embed Base URL</Label>
              <Input
                id="embed_base"
                value={form.embed_base}
                onChange={(e) =>
                  setForm({ ...form, embed_base: e.target.value })
                }
                placeholder="https://embed.filmu.in"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="movie_path">Movie Path</Label>
                <Input
                  id="movie_path"
                  value={form.movie_path}
                  onChange={(e) =>
                    setForm({ ...form, movie_path: e.target.value })
                  }
                  placeholder="embed/movie"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tv_path">TV Path</Label>
                <Input
                  id="tv_path"
                  value={form.tv_path}
                  onChange={(e) => setForm({ ...form, tv_path: e.target.value })}
                  placeholder="embed/tv"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brutality">Ad Brutality</Label>
                <Select
                  value={String(form.brutality)}
                  onValueChange={(v) =>
                    setForm({ ...form, brutality: parseInt(v, 10) })
                  }
                >
                  <SelectTrigger id="brutality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Clean</SelectItem>
                    <SelectItem value="1">1 - Very Low</SelectItem>
                    <SelectItem value="2">2 - Low</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - High</SelectItem>
                    <SelectItem value="5">5 - Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({ ...form, sort_order: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="is_active">Status</Label>
                <Select
                  value={String(form.is_active === 1 ? 1 : 0)}
                  onValueChange={(v) =>
                    setForm({ ...form, is_active: parseInt(v, 10) })
                  }
                >
                  <SelectTrigger id="is_active">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Active</SelectItem>
                    <SelectItem value="0">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Optional fields */}
            <div className="space-y-2">
              <Label htmlFor="api_key">Premium API Key (optional)</Label>
              <Input
                id="api_key"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="zyflix_premium_xxx"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="api_key_param">API Key Param Name</Label>
                <Input
                  id="api_key_param"
                  value={form.api_key_param}
                  onChange={(e) =>
                    setForm({ ...form, api_key_param: e.target.value })
                  }
                  placeholder="api_key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="debug_param">Debug Backdoor</Label>
                <Input
                  id="debug_param"
                  value={form.debug_param}
                  onChange={(e) =>
                    setForm({ ...form, debug_param: e.target.value })
                  }
                  placeholder="debug=savu"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingId ? "Save Changes" : "Add Server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
