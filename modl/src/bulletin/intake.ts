/**
 * 붙여 넣은 주보 글을 칸으로 나눕니다.
 * 글에 없는 제목이나 이름은 만들지 않습니다.
 */

import type { BulletinBlock } from "@/bulletin/blocks";

export const BULLETIN_UPLOAD_BYTES = 30 * 1024 * 1024;

/** 한 요청은 4MB 아래입니다. 배포 서버는 약 4.5MB에서 함수를 시작하기 전에 거절합니다. */
export const BULLETIN_PART_BYTES = 3 * 1024 * 1024;

const ACCEPT = [
  ".txt",
  ".text",
  ".md",
  ".doc",
  ".docx",
  ".hwp",
  ".hwpx",
  ".pdf",
  ".rtf",
  ".odt",
  ".html",
  ".htm",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export function bulletinAccept(): string {
  return ACCEPT.join(",");
}

export function bulletinFormatNote(): string {
  return "직접 적거나 붙여 넣은 글, 텍스트, 워드, 한글, PDF, RTF, ODT, HTML, 사진을 받습니다. jpg, png, webp, heic와 확장자가 없는 사진도 받습니다.";
}

export type IntakeFields = {
  worshipDate: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocks: BulletinBlock[];
};

/** 주보에서 한 번에 읽은 예배 한 부입니다. 없는 순서는 넣지 않습니다. */
export type BulletinServiceDraft = IntakeFields & {
  label: string;
  time: string;
};

const SERVICE_DEFAULTS = {
  "sunday-1": { title: "주일 1부 예배", time: "09:00" },
  "sunday-2": { title: "주일 2부 예배", time: "11:00" },
  "sunday-3": { title: "주일 3부 예배", time: "14:00" },
  wednesday: { title: "수요 예배", time: "19:30" },
  friday: { title: "금요 기도회", time: "21:00" },
  dawn: { title: "새벽 기도회", time: "05:30" },
  special: { title: "특별 예배", time: "11:00" },
} as const;

type ServiceKind = keyof typeof SERVICE_DEFAULTS;

/** 부 번호는 1부, 2부, 3부까지입니다. */
export const BULLETIN_PART_MAX = 3;

type Item = {
  title: string;
  detail: string;
  person: string;
  scripture: string;
  hymn: string;
  song: string;
  kind: "order" | "sermon" | "scripture" | "praise" | "hymn" | "officer" | "announcement";
};

const TITLES = "안수집사|서리집사|전도사|강도사|목사|장로|권사|집사|성도|사모";

type OpenService = {
  kind: ServiceKind;
  label: string;
  time: string;
  date: string;
  items: Item[];
  announcements: string[];
};

/** 주보 글에 있는 예배를 모두 돌려줍니다. 순서가 없는 제목은 예배로 만들지 않습니다. */
export function servicesFromBulletinText(text: string, nextId: () => string): BulletinServiceDraft[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let date = "";
  let current: OpenService | null = null;
  let inAnnouncements = false;
  let inNews = false;
  const opened: OpenService[] = [];
  const news: string[] = [];

  function pushCurrent() {
    if (current && current.items.length > 0) opened.push(current);
    current = null;
    inAnnouncements = false;
  }

  for (const raw of lines) {
    const foundDate = readDate(raw);
    if (foundDate) date = foundDate;
    if (isDateLine(raw)) continue;
    if (raw === "교회소식") {
      inNews = true;
      inAnnouncements = false;
      continue;
    }
    if (inNews) {
      if (isBullet(raw)) {
        const body = stripBullet(raw).slice(0, 500);
        if (body && !isPhoneLine(body) && !isOfferingLine(body)) news.push(body);
        continue;
      }
      inNews = false;
    }
    const header = parseHeader(raw);
    if (header) {
      pushCurrent();
      current = {
        kind: header.kind,
        label: header.title,
        time: header.time,
        date,
        items: [],
        announcements: [],
      };
      continue;
    }
    if (!current) continue;
    if (inAnnouncements && isBullet(raw)) {
      const body = stripBullet(raw).slice(0, 500);
      if (body && !isOfferingLine(body)) current.announcements.push(body);
      continue;
    }
    const item = parseItem(raw);
    if (!item) continue;
    if (item.kind === "announcement") inAnnouncements = true;
    else inAnnouncements = false;
    current.items.push(item);
  }
  pushCurrent();

  const hosts = opened.filter((service) => service.kind === "sunday-1" || service.kind === "sunday-2" || service.kind === "sunday-3" || service.kind === "wednesday");
  for (const service of hosts.length > 0 ? hosts : opened) {
    for (const body of news) {
      if (service.announcements.length >= 30) break;
      if (!service.announcements.includes(body)) service.announcements.push(body);
    }
  }
  return opened.map((service) => toDraft(service, nextId));
}

export function fieldsFromBulletinText(text: string, nextId: () => string): IntakeFields | null {
  const [first] = servicesFromBulletinText(text, nextId);
  if (!first) return null;
  return {
    worshipDate: first.worshipDate,
    sermonTitle: first.sermonTitle,
    scriptureText: first.scriptureText,
    preacher: first.preacher,
    blocks: first.blocks,
  };
}

function toDraft(service: OpenService, nextId: () => string): BulletinServiceDraft {
  const sermon = service.items.find((item) => item.kind === "sermon");
  const scripture = service.items.find((item) => item.kind === "scripture");
  const leader = service.items.find((item) => item.title === "인도" && item.person);
  const blocks: BulletinBlock[] = [];
  const orderItems = service.items.filter((item) => item.kind !== "announcement").slice(0, 40);
  if (orderItems.length > 0) {
    blocks.push({
      id: nextId(),
      type: "order",
      items: orderItems.map((item) => ({
        id: nextId(),
        label: item.title.slice(0, 200),
        detail: orderDetail(item).slice(0, 500),
      })),
    });
  }
  if (sermon) {
    blocks.push({
      id: nextId(),
      type: "sermon",
      title: sermon.detail.slice(0, 200),
      scripture: (scripture?.scripture ?? "").slice(0, 500),
      preacher: (sermon.person || leader?.person || "").slice(0, 120),
    });
  }
  const officers = service.items.filter((item) => item.kind === "officer" && item.person);
  if (officers.length > 0) {
    blocks.push({
      id: nextId(),
      type: "officers",
      people: officers.slice(0, 40).map((item) => ({
        id: nextId(),
        duty: item.title.slice(0, 80),
        name: item.person.slice(0, 80),
      })),
    });
  }
  const songs = service.items.filter((item) => item.kind === "hymn" || item.kind === "praise");
  if (songs.length > 0) {
    blocks.push({
      id: nextId(),
      type: "praise",
      songs: songs.slice(0, 40).map((item) => ({
        id: nextId(),
        title: songLabel(item).slice(0, 200),
        scoreUrl: "",
      })),
    });
  }
  if (service.announcements.length > 0) {
    blocks.push({
      id: nextId(),
      type: "announcement",
      body: service.announcements.join("\n").slice(0, 4000),
    });
  }
  return {
    label: service.label,
    time: service.time,
    worshipDate: service.date,
    sermonTitle: (sermon?.detail ?? "").slice(0, 200),
    scriptureText: (scripture?.scripture ?? "").slice(0, 500),
    preacher: (sermon?.person || leader?.person || "").slice(0, 120),
    blocks,
  };
}

function parseHeader(line: string): { kind: ServiceKind; title: string; time: string } | null {
  if (line.length > 40 || /^[-•·*–]/.test(line) || /^\d+\s*[.)]/.test(line)) return null;
  if (hasTwoServiceParts(line)) return null;
  let kind: ServiceKind | null = null;
  let title = "";
  const part = line.match(/([1-3])\s*부/);
  if (/주일\s*찬양\s*예배/.test(line)) {
    kind = "sunday-3";
    title = "주일찬양예배";
  } else if (part && /예배|오전|오후|\d{1,2}\s*:\s*\d{2}/.test(line)) kind = `sunday-${part[1]}` as ServiceKind;
  else if (line.includes("새벽")) kind = "dawn";
  else if (/수요\s*기도회/.test(line)) {
    kind = "wednesday";
    title = "수요기도회";
  } else if (line.includes("수요")) kind = "wednesday";
  else if (line.includes("금요")) kind = "friday";
  else if (line.includes("특별")) kind = "special";
  else if (/(주일\s*예배|주일예배)/.test(line)) kind = "sunday-2";
  else return null;
  const defaults = SERVICE_DEFAULTS[kind];
  return { kind, time: parseClock(line) ?? defaults.time, title: title || defaults.title };
}

function hasTwoServiceParts(line: string): boolean {
  const first = line.search(/[1-3]\s*부/);
  if (first < 0) return false;
  return /[1-3]\s*부/.test(line.slice(first + 2));
}

function parseClock(line: string): string | null {
  const ampm = line.match(/(오전|오후)\s*(\d{1,2})\s*(?:[:시]\s*(\d{1,2}))?/);
  if (ampm) {
    let hour = Number(ampm[2]);
    const minute = Number(ampm[3] ?? 0);
    if (ampm[1] === "오후" && hour < 12) hour += 12;
    if (ampm[1] === "오전" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const clock = line.match(/(\d{1,2}):(\d{2})/);
  if (!clock) return null;
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function orderDetail(item: Item): string {
  if (item.kind === "hymn") return [item.hymn ? `${item.hymn}장` : "", item.song].filter(Boolean).join(" ");
  if (item.kind === "scripture") return item.scripture;
  if (item.person && item.detail) return `${item.person} ${item.detail}`;
  return item.person || item.detail || item.song;
}

function songLabel(item: Item): string {
  if (item.kind === "hymn") return [item.hymn ? `찬송 ${item.hymn}장` : "찬송", item.song].filter(Boolean).join(" ");
  return item.song || item.detail || item.title;
}

function isOfferingLine(line: string): boolean {
  return /십일조|헌금|봉헌/.test(line);
}

function parseItem(raw: string): Item | null {
  const line = raw.replace(/^\d+\s*[.)]\s*/, "").trim();
  if (isOfferingLine(line)) return null;
  if (line.length > 180 && !/^(찬송|찬양|성가|설교|말씀|성경봉독|기도|대표기도|광고)/.test(line)) return null;
  const hymn = line.match(/^찬송\s*(\d+)\s*장\s*(.*)$/);
  if (hymn) {
    return blank("hymn", "찬송", { hymn: hymn[1], song: hymn[2].trim().slice(0, 200) });
  }
  if (/^묵도/.test(line)) return blank("order", "묵도");
  if (/^사도신경/.test(line)) return blank("order", "사도신경");
  if (/^신앙고백/.test(line)) return blank("order", "신앙고백");
  const praise = line.match(/^찬양\s*(.*)$/);
  if (praise) return blank("praise", "찬양", { song: praise[1].trim().slice(0, 200) });
  if (/^통성기도/.test(line)) return named("officer", "통성기도", line);
  if (/^대표기도/.test(line)) return named("officer", "대표기도", line);
  if (/^기도/.test(line)) return named("officer", "기도", line);
  const scripture = line.match(/^성경봉독\s*(.*)$/);
  if (scripture) return blank("scripture", "성경봉독", { scripture: scripture[1].trim().slice(0, 120) });
  const choir = line.match(/^성가(?:대)?\s*(.*)$/);
  if (choir) return blank("praise", "성가", { song: choir[1].trim().slice(0, 200) });
  const sermon = line.match(/^(설교|말씀)\s*(.*)$/);
  if (sermon) {
    const rest = sermon[2].trim();
    const person = personFrom(rest);
    const detail = person ? rest.replace(person.name, "").replace(person.title, "").trim() : rest;
    return blank("sermon", sermon[1] === "말씀" ? "말씀" : "설교", {
      person: person?.name ?? "",
      detail: (detail || (person ? "" : rest)).slice(0, 200),
    });
  }
  if (/^봉헌/.test(line)) return named("officer", "봉헌", line);
  if (/^광고/.test(line)) return blank("announcement", "광고", { detail: line.replace(/^광고\s*/, "").slice(0, 200) });
  if (/^축도/.test(line)) return named("officer", "축도", line);
  if (/^인도(?:\s|및|$)/.test(line)) return named("officer", "인도", line.replace(/^인도(?:\s*및\s*말씀)?\s*[:：]?\s*/, "인도 "));
  return null;
}

function named(kind: Item["kind"], title: string, line: string): Item {
  const rest = line.replace(new RegExp(`^${title}\\s*`), "").trim();
  const person = personFrom(rest);
  if (!person) return blank(kind, title, { detail: rest.slice(0, 80) });
  const detail = rest.replace(person.name, "").replace(person.title, "").trim();
  return blank(kind, title, { person: person.name, detail: detail.slice(0, 80) });
}

function personFrom(rest: string): { name: string; title: string } | null {
  const match = rest.match(new RegExp(`([가-힣]{2,4})\\s*(${TITLES})`));
  if (!match) return null;
  if (match[1] === "인도") return null;
  return { name: match[1], title: match[2] };
}

function blank(kind: Item["kind"], title: string, extra: Partial<Item> = {}): Item {
  return { kind, title, detail: "", person: "", scripture: "", hymn: "", song: "", ...extra };
}

function readDate(line: string): string {
  const match = line.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!match) return "";
  const iso = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
}

function isDateLine(line: string): boolean {
  if (!/^\d{4}\s*년/.test(line)) return false;
  const rest = line.replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/, "").replace(/[()주일월화수목금토요.\s]/g, "");
  return rest.length === 0;
}

function isBullet(line: string): boolean {
  return /^[-•·*–]\s*\S/.test(line) || /^\.\s+\S/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^(?:[-•·*–]\s*|\.\s+)/, "").trim();
}

function isPhoneLine(text: string): boolean {
  return /\d{2,4}[)\-\s.]?\d{3,4}[-\s.]\d{4}/.test(text);
}
