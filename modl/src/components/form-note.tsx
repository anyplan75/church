"use client";

import { TermText } from "@/components/term-text";
import type { TermKey } from "@/theme/dictionary";

const OK_TERM = {
  community: "create_community",
  invite: "issue_invite",
  applied: "apply_join",
  approved: "approve_member",
  rejected: "reject_member",
  roster: "save",
  season: "start_season",
  group: "add_group",
  assign: "assign_member",
  saved: "bulletin_save",
  published: "bulletin_publish",
  unpublished: "bulletin_unpublish",
} as const;

export function OkNote({ code }: { code?: string }) {
  if (!code || !(code in OK_TERM)) return null;
  return (
    <p role="status" className="rounded-2xl bg-[#e7f3ec] px-4 py-3 leading-relaxed">
      <TermText termKey={OK_TERM[code as keyof typeof OK_TERM] as TermKey} />
    </p>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">
      {message}
    </p>
  );
}
