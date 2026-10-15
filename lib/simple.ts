import type { PersonCategory, Service, Settings, VisitLog, WorshipItem } from "./types";
import { sundayOf } from "./worship";

export const CAPTION_FONTS = [
  { id: "noto-sans-kr", label: "본고딕", family: '"Noto Sans KR", sans-serif' },
  { id: "noto-serif-kr", label: "본명조", family: '"Noto Serif KR", serif' },
  { id: "nanum-gothic", label: "나눔고딕", family: '"Nanum Gothic", sans-serif' },
  { id: "nanum-myeongjo", label: "나눔명조", family: '"Nanum Myeongjo", serif' },
  { id: "ibm-plex-sans-kr", label: "IBM Plex Sans KR", family: '"IBM Plex Sans KR", sans-serif' },
  { id: "gothic-a1", label: "고딕 A1", family: '"Gothic A1", sans-serif' },
  { id: "gowun-batang", label: "고운바탕", family: '"Gowun Batang", serif' },
  { id: "gowun-dodum", label: "고운돋움", family: '"Gowun Dodum", sans-serif' },
  { id: "hahmlet", label: "함렛", family: '"Hahmlet", serif' },
  { id: "song-myung", label: "송명", family: '"Song Myung", serif' },
] as const;

export const DEFAULT_BACKGROUNDS = ["배경 1", "배경 2", "배경 3", "배경 4", "배경 5"];

export const START_BLOCKED = "메인 설정을 마친 뒤에 예배를 시작할 수 있습니다.";

export type WeekBucket = { sunday: string; services: Service[] };

export function bulletinWeeks(services: Service[]): WeekBucket[] {
  const buckets = new Map<string, Service[]>();
  for (const service of services) {
    const sunday = sundayOf(service.date);
    const list = buckets.get(sunday) ?? [];
    list.push(service);
    buckets.set(sunday, list);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([sunday, list]) => ({
      sunday,
      services: list.slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title, "ko")),
    }));
}

export function orderLine(item: WorshipItem): string {
  const extra = [item.pendingName, item.scripture, item.note]
    .map((part) => part.trim())
    .filter((part) => part && !item.title.includes(part));
  return [item.title.trim(), ...extra].join(" ").replace(/\s+/g, " ").trim();
}

export function serviceText(service: Service): string {
  const lines = service.items.map(orderLine).filter(Boolean);
  const ads = service.announcements.map((item) => item.text.trim()).filter(Boolean);
  return [...lines, ...ads].join("\n");
}

export function compactLabel(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").replace(/\.txt$/i, "").toLowerCase();
}

export function captionFont(id: string | undefined): (typeof CAPTION_FONTS)[number] {
  return CAPTION_FONTS.find((font) => font.id === id) ?? CAPTION_FONTS[0];
}

export function fullscreenStep(value: number | undefined): number {
  if (value === 0 || value === 1 || value === 2 || value === 3 || value === 4) return value;
  return 2;
}

export function twoLines(heading: string, line: string): string[] {
  const first = heading.trim();
  const second = line.trim();
  if (first && second) return [first, second];
  const source = first || second;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [source, ""].filter((item, index) => item || index === 0);
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(" "), parts.slice(mid).join(" ")];
}

export function backgroundsOf(settings: Pick<Settings, "backgrounds"> | undefined): string[] {
  const names = (settings?.backgrounds ?? []).map((name) => name.trim()).filter(Boolean);
  const next = names.slice(0, 5);
  while (next.length < 5) next.push(DEFAULT_BACKGROUNDS[next.length]);
  return next;
}

export function setupComplete(settings: Settings): boolean {
  const folders = settings.folders;
  const groups = settings.groups ?? [];
  return Boolean(
    settings.churchName.trim() &&
      (settings.defaultPlace ?? "").trim() &&
      folders?.bible.trim() &&
      folders.hymn.trim() &&
      folders.praise.trim() &&
      groups.some((group) => group.name.trim() && group.personIds.length > 0) &&
      backgroundsOf(settings).length === 5 &&
      captionFont(settings.fullscreenFont) &&
      fullscreenStep(settings.fullscreenStep) >= 0,
  );
}

export function settingsReady(settings: Settings): boolean {
  return settings.mainReady === true && setupComplete(settings);
}

export function screenLabel(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/") return "주보";
  if (path === "/week") return "이번 주";
  if (path === "/people") return "사람";
  if (path === "/library" || path === "/songs") return "라이브러리";
  if (path === "/settings") return "설정";
  if (path.startsWith("/services")) return "예배";
  return "";
}

export function seoulClock(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return `${read("hour")}시 ${read("minute")}분 ${read("second")}초`;
}

export function formatVisit(visit: VisitLog): string {
  const did = visit.did.trim() || "화면";
  const entered = seoulClock(visit.connectedAt);
  if (!visit.leftAt) return `${visit.email}이 ${entered}에 접속해서 ${did} 하고 있습니다.`;
  return `${visit.email}이 ${entered}에 접속해서 ${did} 하고 ${seoulClock(visit.leftAt)}에 나갔습니다.`;
}

export function openVisit(visits: VisitLog[], email: string, at = new Date().toISOString()): VisitLog[] {
  const clean = email.trim().toLowerCase();
  const closed = visits.map((visit) => (visit.email === clean && !visit.leftAt ? { ...visit, leftAt: at } : visit));
  const next: VisitLog = { id: `visit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, email: clean, connectedAt: at, leftAt: null, did: "접속" };
  return [next, ...closed].slice(0, 80);
}

export function noteVisit(visits: VisitLog[], email: string, screen: string): VisitLog[] {
  const clean = email.trim().toLowerCase();
  const label = screen.trim();
  if (!label) return visits;
  return visits.map((visit) => {
    if (visit.email !== clean || visit.leftAt) return visit;
    const parts = visit.did.split(", ").map((part) => part.trim()).filter((part) => part && part !== "접속");
    if (parts.includes(label)) return visit;
    return { ...visit, did: [...parts, label].join(", ") };
  });
}

export function closeVisit(visits: VisitLog[], email: string, at = new Date().toISOString()): VisitLog[] {
  const clean = email.trim().toLowerCase();
  return visits.map((visit) => (visit.email === clean && !visit.leftAt ? { ...visit, leftAt: at } : visit));
}

export function categoryMembership(category: PersonCategory): "member" | "visitor" {
  return category === "unregistered" ? "visitor" : "member";
}
