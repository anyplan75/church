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
  session: "create_session",
  event: "save_event",
  google: "google_synced",
  qt: "save_qt",
  ocr: "ocr_filled",
  prayer: "field_prayer",
  letter: "save_letter",
  read: "letter_read",
  archive: "save_archive",
  quiz: "save_quiz",
  score: "quiz_score",
  grace_kept: "grace_kept",
  pray_kept: "pray_kept",
  category: "category_saved",
  transaction: "transaction_saved",
  sheets: "sheets_synced",
  survey: "survey_saved",
  answer: "answer_saved",
  minutes: "minutes_saved",
} as const;

const NOTE_TERM = {
  sheets_needs_key: "sheets_needs_key",
  no_receipts: "no_receipts",
  receipts_unreadable: "receipts_unreadable",
  survey_closed: "survey_closed",
} as const;

export function OkNote({ code }: { code?: string }) {
  if (!code || !(code in OK_TERM)) return null;
  return (
    <p role="status" className="rounded-2xl bg-[#e7f3ec] px-4 py-3 leading-relaxed">
      <TermText termKey={OK_TERM[code as keyof typeof OK_TERM] as TermKey} />
    </p>
  );
}

export function NoteBanner({ code }: { code?: string }) {
  if (!code || !(code in NOTE_TERM)) return null;
  const termKey = NOTE_TERM[code as keyof typeof NOTE_TERM];
  return (
    <p role="status" data-testid={`note-${code}`} className="rounded-2xl bg-[#fff4e5] px-4 py-3 leading-relaxed">
      <TermText termKey={termKey} />
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
