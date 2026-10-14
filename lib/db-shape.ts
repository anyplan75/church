import { canStoreAttendance } from "./attendance";
import type { ActivityEntry, AttendanceMark, Db, Department, Membership, OverlayPosition, Person, Service, Settings, Song, Supply, SupplyStatus } from "./types";
import { buildSeed } from "./seed";
import { isItemPhoto, oneLine } from "./supplies";
import { normalizeService } from "./worship";

export function normalizeDb(raw: Partial<Db> | null | undefined): Db {
  const seed = buildSeed();
  const data = raw && typeof raw === "object" ? raw : {};
  const people = Array.isArray(data.people) ? data.people.map(normalizePerson) : seed.people;
  return {
    settings: normalizeSettings(data.settings, seed.settings),
    people,
    songs: Array.isArray(data.songs) ? data.songs.map(normalizeSong) : seed.songs,
    services: Array.isArray(data.services) ? data.services.map((service) => normalizeService(service as Service)) : seed.services,
    reminders: Array.isArray(data.reminders) ? data.reminders.filter(isReminder) : [],
    departments: normalizeDepartments(data.departments, seed.departments),
    attendance: normalizeAttendance(data.attendance).filter((mark) => canStoreAttendance(people.find((person) => person.id === mark.personId))),
    supplies: normalizeSupplies(data.supplies),
    activity: normalizeActivity(data.activity),
  };
}

function normalizeSettings(settings: Partial<Settings> | undefined, fallback: Settings): Settings {
  const overlay = settings?.overlay;
  const color = settings?.backgroundColor ?? "";
  const file = typeof settings?.backgroundFile === "string" ? settings.backgroundFile : "";
  const base = file.split(/[/\\]/).pop() ?? "";
  return {
    churchName: String(settings?.churchName ?? fallback.churchName).trim().slice(0, 40) || fallback.churchName,
    backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1b3a32",
    backgroundFile: base || null,
    overlay: overlay === "top" || overlay === "left" || overlay === "right" || overlay === "bottom" ? overlay : "bottom",
  };
}

function normalizePerson(person: Person): Person {
  const membership = membershipOf(person?.membership);
  return {
    id: String(person?.id || crypto.randomUUID()),
    name: String(person?.name ?? "").trim().slice(0, 40) || "이름",
    roles: Array.isArray(person?.roles) ? person.roles.map((role) => String(role).slice(0, 40)).slice(0, 8) : [],
    phone: String(person?.phone ?? "").slice(0, 30),
    active: person?.active !== false,
    membership,
    attendanceConsent: membership === "member" && person?.attendanceConsent === true,
  };
}

function membershipOf(value: unknown): Membership {
  if (value === "visitor" || value === "newcomer" || value === "member") return value;
  return "member";
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

function normalizeDepartments(value: unknown, fallback: Department[]): Department[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const departments: Department[] = [];
  for (const item of value) {
    const record = item as Partial<Department> | null;
    const name = oneLine(record?.name, 40);
    if (!name) continue;
    const key = name.toLocaleLowerCase("ko");
    if (seen.has(key)) continue;
    seen.add(key);
    departments.push({ id: String(record?.id || crypto.randomUUID()), name });
  }
  return departments;
}

function normalizeAttendance(value: unknown): AttendanceMark[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const marks: AttendanceMark[] = [];
  for (const item of value) {
    const record = item as Partial<AttendanceMark> | null;
    const personId = String(record?.personId ?? "");
    const week = String(record?.week ?? "");
    if (!personId || !/^\d{4}-\d{2}-\d{2}$/.test(week) || record?.present !== true) continue;
    const key = `${personId}:${week}`;
    if (seen.has(key)) continue;
    seen.add(key);
    marks.push({ personId, week, present: true });
  }
  return marks;
}

function normalizeSupplies(value: unknown): Supply[] {
  if (!Array.isArray(value)) return [];
  const supplies: Supply[] = [];
  for (const item of value) {
    const record = item as Partial<Supply> | null;
    const name = oneLine(record?.name, 40);
    const photo = String(record?.photo ?? "");
    const status = record?.status;
    if (!name || !isItemPhoto(photo) || !isSupplyStatus(status)) continue;
    supplies.push({
      id: String(record?.id || crypto.randomUUID()),
      departmentId: String(record?.departmentId ?? ""),
      name,
      photo,
      status,
    });
  }
  return supplies;
}

function isSupplyStatus(value: unknown): value is SupplyStatus {
  return value === "have" || value === "need" || value === "requested";
}

function normalizeActivity(value: unknown): ActivityEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: ActivityEntry[] = [];
  for (const item of value) {
    const record = item as Partial<ActivityEntry> | null;
    const email = String(record?.email ?? "").trim().toLowerCase().slice(0, 120);
    const action = String(record?.action ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
    const at = String(record?.at ?? "");
    if (!email || !action || !at) continue;
    entries.push({ id: String(record?.id || crypto.randomUUID()), at: at.slice(0, 40), email, action });
    if (entries.length >= 400) break;
  }
  return entries;
}

function isReminder(value: Db["reminders"][number]): value is Db["reminders"][number] {
  return Boolean(value && typeof value.id === "string" && typeof value.serviceId === "string" && (value.kind === "day-before" || value.kind === "hour-before"));
}

export function isOverlayPosition(value: string): value is OverlayPosition {
  return value === "bottom" || value === "top" || value === "left" || value === "right";
}
