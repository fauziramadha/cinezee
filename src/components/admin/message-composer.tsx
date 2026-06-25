/**
 * src/components/admin/message-composer.tsx
 *
 * Admin UI untuk:
 * - Compose & send message (broadcast or to specific user)
 * - View sent messages with read stats
 * - Delete / pin messages
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Send,
  Trash2,
  Pin,
  PinOff,
  Users,
  User,
  Loader2,
  AlertCircle,
  Mail,
  Megaphone,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface SimpleUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface AdminMessage {
  id: number;
  sender_id: string;
  sender_name: string | null;
  recipient_id: string | null;
  recipient_name: string | null;
  subject: string | null;
  body: string;
  type: string;
  is_pinned: number;
  created_at: string;
  expires_at: string | null;
  read_count?: number;
  recipient_count?: number;
}

const TYPE_META: Record<string, { label: string; color: string; icon: any }> = {
  info: {
    label: "Info",
    color: "border-blue-500/40 text-blue-400",
    icon: Mail,
  },
  warning: {
    label: "Warning",
    color: "border-yellow-500/40 text-yellow-400",
    icon: AlertCircle,
  },
  announcement: {
    label: "Announcement",
    color: "border-purple-500/40 text-purple-400",
    icon: Megaphone,
  },
  system: {
    label: "System",
    color: "border-gray-500/40 text-gray-400",
    icon: AlertCircle,
  },
};

export function MessageComposer() {
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [recipientType, setRecipientType] = useState<"all" | "user">("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<string>("info");
  const [isPinned, setIsPinned] = useState(false);

  // === Fetch users ===
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e: any) {
      toast.error("Failed to load users list");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // === Fetch messages ===
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/messages");
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e: any) {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchMessages();
  }, [fetchUsers, fetchMessages]);

  // === Send message ===
  const handleSend = async () => {
    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }

    if (recipientType === "user" && !selectedUserId) {
      toast.error("Please select a recipient");
      return;
    }

    setSending(true);
    try {
      const selectedUser = users.find((u) => u.id === selectedUserId);

      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: recipientType === "all" ? null : selectedUserId,
          recipientName: selectedUser?.name || selectedUser?.email || null,
          subject: subject || null,
          body,
          type,
          isPinned,
        }),
      });

      if (!res.ok) throw new Error("Failed to send");
      toast.success(
        recipientType === "all"
          ? "Broadcast sent to all users"
          : `Message sent to ${selectedUser?.name || selectedUser?.email}`
      );

      // Reset form
      setSubject("");
      setBody("");
      setType("info");
      setIsPinned(false);
      setSelectedUserId("");

      fetchMessages();
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  // === Delete message ===
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Message deleted");
      fetchMessages();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  };

  // === Toggle pin ===
  const handleTogglePin = async (msg: AdminMessage) => {
    try {
      const res = await fetch(`/api/admin/messages/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pin",
          is_pinned: !msg.is_pinned,
        }),
      });
      if (!res.ok) throw new Error("Failed to toggle pin");
      toast.success(msg.is_pinned ? "Unpinned" : "Pinned");
      fetchMessages();
    } catch (e: any) {
      toast.error(e.message || "Pin toggle failed");
    }
  };

  // Filter messages by search
  const filteredMessages = messages.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.body.toLowerCase().includes(q) ||
      (m.subject?.toLowerCase().includes(q) ?? false) ||
      (m.recipient_name?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Messaging</h2>
        <p className="text-sm text-muted-foreground">
          Send messages to individual users or broadcast to everyone.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ============ COMPOSE FORM ============ */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Send className="h-4 w-4" />
            Compose Message
          </h3>

          {/* Recipient type */}
          <div className="space-y-2">
            <Label>Recipient</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={recipientType === "all" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setRecipientType("all")}
              >
                <Users className="h-4 w-4" />
                All Users
              </Button>
              <Button
                type="button"
                variant={recipientType === "user" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setRecipientType("user")}
              >
                <User className="h-4 w-4" />
                Specific User
              </Button>
            </div>
          </div>

          {/* User picker (if specific user) */}
          {recipientType === "user" && (
            <div className="space-y-2">
              <Label>Select User</Label>
              {usersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No registered users yet.
                </p>
              ) : (
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email || "Unknown"}{" "}
                        {u.email && u.name ? `(${u.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief subject line"
              maxLength={120}
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              rows={5}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {body.length}/2000
            </p>
          </div>

          {/* Pinned */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPinned"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="isPinned" className="cursor-pointer">
              Pin to top of users inbox
            </Label>
          </div>

          {/* Send button */}
          <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Message
          </Button>
        </Card>

        {/* ============ SENT MESSAGES LIST ============ */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Sent Messages</h3>
            <div className="relative w-48">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-8 h-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              No messages sent yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredMessages.map((msg) => {
                const meta = TYPE_META[msg.type] || TYPE_META.info;
                const Icon = meta.icon;
                return (
                  <div
                    key={msg.id}
                    className="rounded-lg border border-border p-3 space-y-2"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 shrink-0" />
                        <Badge variant="outline" className={meta.color}>
                          {meta.label}
                        </Badge>
                        {msg.is_pinned === 1 && (
                          <Badge variant="outline" className="border-yellow-500/40 text-yellow-400">
                            <Pin className="h-3 w-3 mr-1" />
                            Pinned
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>

                    {/* Recipient */}
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {msg.recipient_id === null ? (
                        <>
                          <Users className="h-3 w-3" />
                          All Users (Broadcast)
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3" />
                          {msg.recipient_name || "Unknown"}
                        </>
                      )}
                    </div>

                    {/* Subject */}
                    {msg.subject && (
                      <div className="font-medium text-sm">{msg.subject}</div>
                    )}

                    {/* Body preview */}
                    <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                      {msg.body}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {msg.recipient_id === null
                          ? `${msg.read_count || 0} / ${msg.recipient_count || 0} read`
                          : msg.read_count
                            ? "Read"
                            : "Unread"}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleTogglePin(msg)}
                          title={msg.is_pinned ? "Unpin" : "Pin"}
                        >
                          {msg.is_pinned ? (
                            <PinOff className="h-3.5 w-3.5" />
                          ) : (
                            <Pin className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(msg.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
