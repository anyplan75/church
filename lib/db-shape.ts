import { canStoreAttendance } from "./attendance";
import { backgroundsOf, captionFont, fullscreenStep } from "./simple";
import type { ActivityEntry, AttendanceMark, Db, Department, Membership, Office, OverlayPosition, Person, PersonCategory, Service, Settings, Song, Supply, SupplyStatus, VisitLog } from "./types";
import { OFFICES, PERSON_CATEGORIES } from "./types";
import { isItemPhoto, oneLine } from "./supplies";
import { normalizeService } from "./worship";

const EMPTY_SETTINGS: Settings = { churchName: "교회", backgroundColor: "#1b3a32", backgroundFile: null, overlay: "bottom" };

export function normalizeDb(raw: Partial<Db> | null | undefined): Db {
  const data = raw && typeof raw === "object" ? raw : {};
  const people = Array.isArray(data.people) ? data.people.map(normalizePerson) : [];
  return {
    settings: normalizeSettings(data.settings, EMPTY_SETTINGS),
    people,
    songs: Array.isArray(data.songs) ? data.songs.map(normalizeSong) : [],
    services: Array.isArray(data.services) ? data.services.map((service) => normalizeService(service as Service)) : [],
    reminders: Array.isArray(data.reminders) ? data.reminders.filter(isReminder) : [],
    departments: normalizeDepartments(data.departments, []),
    attendance: normalizeAttendance(data.attendance).filter((mark) => canStoreAttendance(people.find((person) => person.id === mark.personId))),
    supplies: normalizeSupplies(data.supplies),
    activity: normalizeActivity(data.activity),
    visits: normalizeVisits(data.visits),
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
    defaultPlace: String(settings?.defaultPlace ?? "본당").trim().slice(0, 40) || "본당",
    folders: {
      bible: String(settings?.folders?.bible ?? "").trim().slice(0, 80),
      hymn: String(settings?.folders?.hymn ?? "").trim().slice(0, 80),
      praise: String(settings?.folders?.praise ?? "").trim().slice(0, 80),
    },
    groups: normalizeGroups(settings?.groups),
    mainReady: settings?.mainReady === true,
    overlayFont: captionFont(settings?.overlayFont).id,
    fullscreenFont: captionFont(settings?.fullscreenFont).id,
    fullscreenStep: fullscreenStep(settings?.fullscreenStep),
    backgrounds: backgroundsOf(settings ?? fallback),
  };
}

function normalizePerson(person: Person): Person {
  const office = officeOf(person);
  const category = categoryOf(person, office);
  const membership = category === "unregistered" ? "visitor" : membershipOf(person?.membership) === "visitor" ? "member" : membershipOf(person?.membership);
  const storedMembership = category === "unregistered" ? "visitor" : membership === "newcomer" ? "newcomer" : "member";
  return {
    id: String(person?.id || crypto.randomUUID()),
    name: String(person?.name ?? "").trim().slice(0, 40) || "이름",
    roles: office ? [office] : Array.isArray(person?.roles) ? person.roles.map((role) => String(role).slice(0, 40)).slice(0, 8) : [],
    phone: String(person?.phone ?? "").slice(0, 30),
    active: person?.active !== false,
    membership: storedMembership,
    attendanceConsent: storedMembership === "member" && person?.attendanceConsent === true,
    category,
    office,
    address: String(person?.address ?? "").trim().slice(0, 120),
    email: String(person?.email ?? "").trim().slice(0, 120),
    memo: String(person?.memo ?? "").trim().slice(0, 400),
    photo: isItemPhoto(String(person?.photo ?? "")) ? String(person.photo) : "",
  };
}

function categoryOf(person: Person, office: Office | ""): PersonCategory {
  if (PERSON_CATEGORIES.some((item) => item.id === person?.category)) return person.category as PersonCategory;
  if (person?.membership === "visitor" || person?.membership === "newcomer") return "unregistered";
  if (office === "목사" || office === "전도사") return "minister";
  return "registered";
}

function officeOf(person: Person): Office | "" {
  if (OFFICES.includes(person?.office as Office)) return person.office as Office;
  const text = Array.isArray(person?.roles) ? person.roles.join(" ") : "";
  return OFFICES.find((office) => text.includes(office)) ?? "";
}

function normalizeGroups(value: Settings["groups"]): Settings["groups"] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 30)
    .map((group) => ({
      id: String(group?.id || crypto.randomUUID()),
      name: String(group?.name ?? "").trim().slice(0, 40),
      personIds: Array.isArray(group?.personIds) ? group.personIds.map((id) => String(id)).slice(0, 80) : [],
    }))
    .filter((group) => group.name);
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

function normalizeVisits(value: unknown): VisitLog[] {
  if (!Array.isArray(value)) return [];
  const visits: VisitLog[] = [];
  for (const item of value) {
    const record = item as Partial<VisitLog> | null;
    const email = String(record?.email ?? "").trim().toLowerCase().slice(0, 120);
    const connectedAt = String(record?.connectedAt ?? "");
    if (!email || !connectedAt) continue;
    visits.push({
      id: String(record?.id || crypto.randomUUID()),
      email,
      connectedAt: connectedAt.slice(0, 40),
      leftAt: record?.leftAt ? String(record.leftAt).slice(0, 40) : null,
      did: String(record?.did ?? "").replace(/\s+/g, " ").trim().slice(0, 160) || "접속",
    });
    if (visits.length >= 80) break;
  }
  return visits;
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
