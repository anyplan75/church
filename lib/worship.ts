import {
  ITEM_KINDS,
  SERVICE_TYPES,
  STATUSES,
  type ItemKind,
  type Person,
  type Service,
  type ServiceStatus,
  type ServiceType,
  type Song,
  type WorshipItem,
} from "./types";

const ASSIGNED_KINDS = new Set<ItemKind>([
  "praise",
  "prayer",
  "scripture",
  "choir",
  "sermon",
  "offering",
  "announcement",
  "benediction",
]);

const SUNDAY_ROWS: Array<Pick<WorshipItem, "kind" | "title">> = [
  { kind: "meditation", title: "묵도" },
  { kind: "hymn", title: "찬송" },
  { kind: "creed", title: "사도신경" },
  { kind: "praise", title: "찬양" },
  { kind: "prayer", title: "대표기도" },
  { kind: "scripture", title: "성경봉독" },
  { kind: "choir", title: "성가" },
  { kind: "sermon", title: "설교" },
  { kind: "offering", title: "봉헌" },
  { kind: "announcement", title: "광고" },
  { kind: "hymn", title: "찬송" },
  { kind: "benediction", title: "축도" },
];

const PRAYER_ROWS: Array<Pick<WorshipItem, "kind" | "title">> = [
  { kind: "praise", title: "찬양" },
  { kind: "prayer", title: "기도" },
  { kind: "scripture", title: "성경봉독" },
  { kind: "sermon", title: "말씀" },
  { kind: "prayer", title: "통성기도" },
  { kind: "offering", title: "봉헌" },
  { kind: "benediction", title: "축도" },
];

const DAWN_ROWS: Array<Pick<WorshipItem, "kind" | "title">> = [
  { kind: "hymn", title: "찬송" },
  { kind: "prayer", title: "기도" },
  { kind: "scripture", title: "성경봉독" },
  { kind: "sermon", title: "설교" },
  { kind: "benediction", title: "축도" },
];

export function kindLabel(kind: string): string {
  return ITEM_KINDS.find((item) => item.id === kind)?.label ?? "기타";
}

export function serviceTypeLabel(type: string): string {
  return SERVICE_TYPES.find((item) => item.id === type)?.label ?? "예배";
}

export function statusLabel(status: string): string {
  return STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function serviceTypeDefaults(type: ServiceType): { title: string; time: string } {
  const found = SERVICE_TYPES.find((item) => item.id === type);
  return {
    title: found?.defaultTitle ?? "예배",
    time: found?.defaultTime ?? "11:00",
  };
}

export function isServiceType(value: string): value is ServiceType {
  return SERVICE_TYPES.some((item) => item.id === value);
}

export function isServiceStatus(value: string): value is ServiceStatus {
  return STATUSES.some((item) => item.id === value);
}

export function isItemKind(value: string): value is ItemKind {
  return ITEM_KINDS.some((item) => item.id === value);
}

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function sundayOf(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

export function mondayOf(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function comingSunday(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? 0 : 7 - weekday;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function reorder<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const copy = items.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item);
  return copy;
}

export function clampLiveIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), length - 1);
}

export function needsPerson(kind: ItemKind): boolean {
  return ASSIGNED_KINDS.has(kind);
}

export function assignmentProgress(service: Service): { assigned: number; total: number } {
  const needing = service.items.filter((item) => needsPerson(item.kind));
  return {
    total: needing.length,
    assigned: needing.filter((item) => item.personId).length,
  };
}

export function compareService(a: Service, b: Service): number {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title, "ko");
}

export function splitServices(services: Service[], today: string): { upcoming: Service[]; past: Service[] } {
  const upcoming = services
    .filter((service) => service.status !== "done" && (service.date >= today || service.status === "live"))
    .slice()
    .sort(compareService);
  const upcomingIds = new Set(upcoming.map((service) => service.id));
  const past = services
    .filter((service) => !upcomingIds.has(service.id))
    .slice()
    .sort((a, b) => compareService(b, a));
  return { upcoming, past };
}

export function nextService(services: Service[], today: string): Service | null {
  const live = services.filter((service) => service.status === "live").slice().sort(compareService);
  if (live.length > 0) return live[0];
  return splitServices(services, today).upcoming[0] ?? null;
}

export function weekServices(services: Service[], today: string): Service[] {
  const start = sundayOf(today);
  const end = addDays(start, 6);
  return services
    .filter((service) => service.date >= start && service.date <= end)
    .slice()
    .sort(compareService);
}

function bare(rows: Array<Pick<WorshipItem, "kind" | "title">>): Array<Omit<WorshipItem, "id">> {
  return rows.map((row) => ({
    kind: row.kind,
    title: row.title,
    note: "",
    scripture: "",
    scriptureText: "",
    scriptureLicensed: false,
    screenCue: "",
    personId: null,
    pendingName: "",
    songId: null,
  }));
}

export function templateItems(type: ServiceType): Array<Omit<WorshipItem, "id">> {
  if (type === "dawn") return bare(DAWN_ROWS);
  if (type === "wednesday" || type === "friday") return bare(PRAYER_ROWS);
  return bare(SUNDAY_ROWS);
}

export function createItem(kind: ItemKind = "other"): WorshipItem {
  return {
    id: crypto.randomUUID(),
    kind,
    title: kindLabel(kind),
    note: "",
    scripture: "",
    scriptureText: "",
    scriptureLicensed: false,
    screenCue: "",
    personId: null,
    pendingName: "",
    songId: null,
  };
}

export function personName(people: Person[], id: string | null): string {
  if (!id) return "";
  return people.find((person) => person.id === id)?.name ?? "";
}

export function describeSong(song: Song | undefined): string {
  if (!song) return "";
  return song.hymnNumber ? `${song.hymnNumber}장 ${song.title}` : song.title;
}

export function songOptionLabel(song: Song): string {
  const title = describeSong(song);
  return song.key ? `${title} · ${song.key}` : title;
}

export function itemAside(item: WorshipItem, people: Person[], songs: Song[]): string {
  const person = personName(people, item.personId) || item.pendingName.trim();
  const song = describeSong(songs.find((entry) => entry.id === item.songId));
  if (!person && !song && (item.kind === "meditation" || item.kind === "creed")) return "다함께";
  return [person, song].filter(Boolean).join(" · ");
}

export function preacherName(service: Service, people: Person[]): string {
  return personName(people, service.preacherId) || personName(people, service.items.find((item) => item.kind === "sermon")?.personId ?? null);
}

export function normalizeService(input: Service): Service {
  if (!input || typeof input.id !== "string" || input.id.length === 0) {
    throw new Error("예배 정보가 올바르지 않습니다.");
  }
  const items = (Array.isArray(input.items) ? input.items : []).slice(0, 40).map(normalizeItem);
  const announcements = (Array.isArray(input.announcements) ? input.announcements : [])
    .slice(0, 30)
    .map((announcement) => ({
      id: String(announcement.id || crypto.randomUUID()),
      text: String(announcement.text ?? "").slice(0, 500),
    }));
  const status = isServiceStatus(input.status) ? input.status : "planning";
  return {
    id: input.id,
    title: String(input.title ?? "").trim().slice(0, 80) || "예배",
    date: isISODate(input.date) ? input.date : todayISO(),
    time: isTime(input.time) ? input.time : "11:00",
    type: isServiceType(input.type) ? input.type : "special",
    place: String(input.place ?? "").trim().slice(0, 40) || "본당",
    preacherId: input.preacherId || null,
    status,
    items,
    announcements,
    liveIndex: clampLiveIndex(Number(input.liveIndex) || 0, items.length),
    liveSlide: clampLiveIndex(Number(input.liveSlide) || 0, 40),
    startedAt: typeof input.startedAt === "string" && input.startedAt ? input.startedAt : null,
    notes: String(input.notes ?? "").slice(0, 2000),
    checks: normalizeChecks(input.checks),
    source: input.source === "bulletin" ? "bulletin" : "manual",
    groupId: input.groupId || null,
  };
}

function normalizeItem(item: WorshipItem): WorshipItem {
  const kind = isItemKind(item?.kind) ? item.kind : "other";
  return {
    id: String(item?.id || crypto.randomUUID()),
    kind,
    title: String(item?.title ?? "").trim().slice(0, 80) || kindLabel(kind),
    note: String(item?.note ?? "").slice(0, 300),
    scripture: String(item?.scripture ?? "").slice(0, 120),
    scriptureLicensed: item?.scriptureLicensed === true,
    scriptureText: item?.scriptureLicensed === true ? String(item?.scriptureText ?? "").slice(0, 400) : "",
    screenCue: String(item?.screenCue ?? "").slice(0, 80),
    personId: item?.personId || null,
    pendingName: item?.personId ? "" : String(item?.pendingName ?? "").trim().slice(0, 40),
    songId: item?.songId || null,
  };
}

function normalizeChecks(checks: Service["checks"] | undefined): Record<string, boolean> {
  if (!checks || typeof checks !== "object") return {};
  return Object.fromEntries(
    Object.entries(checks)
      .filter(([key, value]) => key.length < 40 && typeof value === "boolean")
      .slice(0, 40),
  );
}
