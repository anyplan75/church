import fs from "fs";
import path from "path";
import { buildSeed } from "./seed";
import type { Db, OverlayPosition, Person, Service, Settings, Song } from "./types";
import { normalizeService } from "./worship";

const file = path.join(process.cwd(), "data", "church.json");

function write(db: Db) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(db, null, 2));
  fs.renameSync(temporary, file);
}

export function readDb(): Db {
  if (!fs.existsSync(file)) {
    const db = buildSeed();
    write(db);
    return db;
  }
  return normalizeDb(JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Db>);
}

export function updateDb(mutator: (db: Db) => void): Db {
  const db = readDb();
  mutator(db);
  const next = JSON.stringify(db, null, 2);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== next) write(db);
  return db;
}

function normalizeDb(raw: Partial<Db> | null | undefined): Db {
  const seed = buildSeed();
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    settings: normalizeSettings(data.settings, seed.settings),
    people: Array.isArray(data.people) ? data.people.map(normalizePerson) : seed.people,
    songs: Array.isArray(data.songs) ? data.songs.map(normalizeSong) : seed.songs,
    services: Array.isArray(data.services) ? data.services.map((service) => normalizeService(service as Service)) : seed.services,
    reminders: Array.isArray(data.reminders) ? data.reminders.filter(isReminder) : [],
  };
}

function normalizeSettings(settings: Partial<Settings> | undefined, fallback: Settings): Settings {
  const overlay = settings?.overlay;
  const color = settings?.backgroundColor ?? "";
  return {
    churchName: String(settings?.churchName ?? fallback.churchName).trim().slice(0, 40) || fallback.churchName,
    backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1b3a32",
    backgroundFile: typeof settings?.backgroundFile === "string" && settings.backgroundFile ? path.basename(settings.backgroundFile) : null,
    overlay: overlay === "top" || overlay === "left" || overlay === "right" || overlay === "bottom" ? overlay : "bottom",
  };
}

function normalizePerson(person: Person): Person {
  return {
    id: String(person?.id || crypto.randomUUID()),
    name: String(person?.name ?? "").trim().slice(0, 40) || "이름",
    roles: Array.isArray(person?.roles) ? person.roles.map((role) => String(role).slice(0, 40)).slice(0, 8) : [],
    phone: String(person?.phone ?? "").slice(0, 30),
    active: person?.active !== false,
  };
}

function normalizeSong(song: Song): Song {
  const license = song?.license === "permitted" ? "permitted" : "title-only";
  return {
    id: String(song?.id || crypto.randomUUID()),
    title: String(song?.title ?? "").trim().slice(0, 80) || "찬양",
    hymnNumber: String(song?.hymnNumber ?? "").slice(0, 10),
    key: String(song?.key ?? "").slice(0, 8),
    license,
    permittedLine: license === "permitted" ? String(song?.permittedLine ?? "").slice(0, 80) : "",
  };
}

function isReminder(value: Db["reminders"][number]): value is Db["reminders"][number] {
  return Boolean(value && typeof value.id === "string" && typeof value.serviceId === "string" && (value.kind === "day-before" || value.kind === "hour-before"));
}

export function isOverlayPosition(value: string): value is OverlayPosition {
  return value === "bottom" || value === "top" || value === "left" || value === "right";
}
