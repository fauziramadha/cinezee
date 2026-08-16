"use client";

import { useState } from "react";
import {
  MessageSquare,
  Send,
  Trash2,
  CornerDownRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeLabel } from "@/components/badge/badge-label";
import { getAvatarRingClass } from "@/components/badge/avatar-ring";
import { cn } from "@/lib/utils";
import type { CommentItem } from "./types";

interface DetailCommentsProps {
  comments: CommentItem[];
  commentText: string;
  setCommentText: (text: string) => void;
  onPostComment: () => void;
  commentLoading: boolean;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  replyText: string;
  setReplyText: (text: string) => void;
  onPostReply: (parentId: string) => void;
  onDeleteComment: (id: string) => void;
  isAuthenticated: boolean;
  userImage?: string | null;
  userName?: string | null;
}

export function DetailComments({
  comments,
  commentText,
  setCommentText,
  onPostComment,
  commentLoading,
  replyTo,
  setReplyTo,
  replyText,
  setReplyText,
  onPostReply,
  onDeleteComment,
  isAuthenticated,
  userImage,
  userName,
}: DetailCommentsProps) {
  return (
    <div className="border-t border-border px-4 py-4 pb-12 sm:px-6 sm:py-6 md:px-8">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
        <MessageSquare className="h-4 w-4" />
        Comments ({comments.length})
      </h3>

      {/* Comment input */}
      <div className="mb-4 flex gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={userImage || undefined} />
          <AvatarFallback className="bg-primary/20 text-xs text-primary">
            {userName?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={
              isAuthenticated ? "Tulis komentar..." : "Login untuk berkomentar"
            }
            disabled={!isAuthenticated}
            className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-50"
            rows={2}
            maxLength={2000}
          />
          {isAuthenticated && (
            <Button
              size="sm"
              onClick={onPostComment}
              disabled={!commentText.trim() || commentLoading}
              className="mt-2 gap-1.5"
            >
              {commentLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Post
            </Button>
          )}
        </div>
      </div>

      {/* Comments list */}
      <div
        className="max-h-[300px] space-y-3 overflow-y-auto pr-1"
        style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
      >
        {comments.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Belum ada komentar. Jadilah yang pertama!
          </p>
        ) : (
          comments.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              currentUserId={userName}
              onReply={(id: string) => {
                setReplyTo(id);
                setReplyText("");
              }}
              replyTo={replyTo}
              replyText={replyText}
              setReplyText={setReplyText}
              onPostReply={onPostReply}
              onDelete={onDeleteComment}
              commentLoading={commentLoading}
              level={0}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// Comment Node Component
// ============================================================
function CommentNode({
  comment,
  currentUserId,
  onReply,
  replyTo,
  replyText,
  setReplyText,
  onPostReply,
  onDelete,
  commentLoading,
  level,
}: any) {
  const initial = comment.userName?.[0]?.toUpperCase() || "U";
  const timeAgo = new Date(comment.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const isOwner = currentUserId === comment.userId;
  const badge = comment.userBadge;

  return (
    <div className={level > 0 ? "ml-6 border-l border-border pl-3" : ""}>
      <div className="flex gap-2">
        <Avatar className={cn("h-8 w-8 shrink-0", getAvatarRingClass(badge?.slug))}>
          <AvatarImage src={comment.userImage || undefined} />
          <AvatarFallback className="bg-primary/20 text-xs text-primary">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold">
                  {comment.userName || "Anonymous"}
                </span>
                {badge && <BadgeLabel slug={badge.slug} name={badge.name} size={10} />}
              </div>
              <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
            </div>
            <p className="mt-1 break-words text-xs leading-relaxed sm:text-sm">
              {comment.content}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-1">
            <button
              onClick={() => onReply(comment.id)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
            >
              <CornerDownRight className="h-3 w-3" />
              Reply
            </button>
            {isOwner && (
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
          </div>
          {replyTo === comment.id && (
            <div className="mt-2 flex gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${comment.userName || "user"}...`}
                className="flex-1 resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-xs outline-none focus:border-primary"
                rows={2}
                maxLength={2000}
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => onPostReply(comment.id)}
                disabled={!replyText.trim() || commentLoading}
                className="gap-1 self-end"
              >
                {commentLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((r: any) => (
            <CommentNode
              key={r.id}
              comment={r}
              currentUserId={currentUserId}
              onReply={onReply}
              replyTo={replyTo}
              replyText={replyText}
              setReplyText={setReplyText}
              onPostReply={onPostReply}
              onDelete={onDelete}
              commentLoading={commentLoading}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
