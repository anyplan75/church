import { parseBulletin } from "./bulletin-parse";
import type { BulletinDraft } from "./bulletin-parse";
import type { Db, Service, Song } from "./types";
import { todayISO } from "./worship";

export function applyBulletin(db: Db, text: string, today = todayISO()): { imported: number; skipped: number; skippedLyrics: number } {
  const parsed = parseBulletin(text, db.people, today);
  let imported = 0;
  let skipped = 0;
  for (const draft of parsed.services) {
    const same = db.services.filter((service) => service.date === draft.date && service.type === draft.type);
    const editable = same.find((service) => service.status === "planning" || service.status === "ready");
    const blocked = same.some((service) => service.status === "live" || service.status === "done");
    if (!editable && blocked) {
      skipped += 1;
      continue;
    }
    const next = draftToService(db, draft);
    if (editable) {
      editable.title = next.title;
      editable.time = next.time;
      editable.place = next.place;
      editable.preacherId = next.preacherId;
      editable.items = next.items;
      editable.announcements = next.announcements;
      editable.source = "bulletin";
      editable.checks = {};
      editable.liveIndex = 0;
      if (editable.status === "ready") editable.status = "planning";
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
    place: "본당",
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
  if (!name) return null;
  return db.people.find((person) => person.name === name)?.id ?? null;
}
