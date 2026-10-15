import { parseBulletin } from "./bulletin-parse";
import type { BulletinDraft } from "./bulletin-parse";
import { findRosterPerson } from "./person-name";
import type { Db, Service, Song } from "./types";
import { todayISO } from "./worship";

export function applyBulletin(db: Db, text: string, today = todayISO(), mode: "import" | "refill" = "import"): { imported: number; skipped: number; skippedLyrics: number } {
  const parsed = parseBulletin(text, db.people, today);
  let imported = 0;
  let skipped = 0;
  for (const draft of parsed.services) {
    const sameTime = db.services.filter((service) => service.date === draft.date && service.time === draft.time);
    const same = sameTime.length > 0 ? sameTime : db.services.filter((service) => service.date === draft.date && service.type === draft.type);
    const editable = same.find((service) => service.status === "planning" || service.status === "ready");
    const finished = same.find((service) => service.status === "live" || service.status === "done");
    const target = editable ?? (mode === "refill" ? finished : undefined);
    if (!target && finished) {
      skipped += 1;
      continue;
    }
    const next = draftToService(db, draft);
    if (target) {
      const keepRun = mode === "refill" && (target.status === "live" || target.status === "done");
      target.title = next.title;
      target.time = next.time;
      target.type = next.type;
      target.place = next.place;
      target.preacherId = next.preacherId;
      target.items = next.items;
      target.announcements = next.announcements;
      target.source = "bulletin";
      if (!keepRun) {
        target.checks = {};
        target.liveIndex = 0;
        if (target.status === "ready") target.status = "planning";
      }
    } else {
      db.services.push(next);
    }
    imported += 1;
  }
  return { imported, skipped, skippedLyrics: parsed.skippedLyrics };
}

function draftToService(db: Db, draft: BulletinDraft): Service {
  const preacher = findPersonId(db, draft.preacherName);
  return {
    id: crypto.randomUUID(),
    title: draft.title,
    date: draft.date,
    time: draft.time,
    type: draft.type,
    place: draft.place || "본당",
    preacherId: preacher,
    status: "planning",
    items: draft.items.map((item) => {
      const personId = findPersonId(db, item.personName);
      const songId = item.hymnNumber || item.songTitle ? ensureSong(db, item.hymnNumber, item.songTitle) : null;
      return {
        id: crypto.randomUUID(),
        kind: item.kind,
        title: item.title,
        note: item.kind === "hymn" || item.kind === "praise" ? "" : item.note,
        scripture: item.scripture,
        scriptureText: "",
        scriptureLicensed: false,
        screenCue: "",
        personId,
        pendingName: personId ? "" : item.personName.trim().slice(0, 40),
        songId,
      };
    }),
    announcements: draft.announcements.map((text) => ({ id: crypto.randomUUID(), text })),
    liveIndex: 0,
    startedAt: null,
    notes: "",
    checks: {},
    source: "bulletin",
  };
}

function ensureSong(db: Db, hymnNumber: string, songTitle: string): string {
  const found = db.songs.find((song) => (hymnNumber && song.hymnNumber === hymnNumber) || (!hymnNumber && songTitle && song.title === songTitle));
  if (found) return found.id;
  const song: Song = {
    id: crypto.randomUUID(),
    title: songTitle || (hymnNumber ? `찬송 ${hymnNumber}장` : "찬양"),
    hymnNumber,
    key: "",
    license: "title-only",
    permittedLine: "",
  };
  db.songs.push(song);
  return song.id;
}

function findPersonId(db: Db, name: string): string | null {
  if (!name.trim()) return null;
  return findRosterPerson(name, db.people)?.id ?? null;
}
