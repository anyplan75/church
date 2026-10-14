import { bulletinPersonName, stripPersonMention } from "./person-name";
import type { ItemKind, Person, ServiceType } from "./types";
import { isISODate, serviceTypeDefaults, todayISO } from "./worship";

export type BulletinItem = {
  kind: ItemKind;
  title: string;
  note: string;
  scripture: string;
  personName: string;
  hymnNumber: string;
  songTitle: string;
};

export type BulletinDraft = {
  title: string;
  date: string;
  time: string;
  type: ServiceType;
  preacherName: string;
  place: string;
  items: BulletinItem[];
  announcements: string[];
};

const ITEM_START = /^(묵도|사도신경|신앙고백|찬송|찬양|통성기도|대표기도|기도|성경봉독|성가|설교|말씀|봉헌|광고|축도)/;

export function parseBulletin(text: string, people: Person[], today = todayISO()): { services: BulletinDraft[]; skippedLyrics: number } {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let date = "";
  let current: BulletinDraft | null = null;
  let inAnnouncements = false;
  let skippedLyrics = 0;
  const services: BulletinDraft[] = [];

  function pushCurrent() {
    if (current && current.items.length > 0) services.push(current);
    current = null;
    inAnnouncements = false;
  }

  for (const raw of lines) {
    const foundDate = readDate(raw);
    if (foundDate) date = foundDate;
    if (isDateLine(raw)) continue;

    const header = parseHeader(raw);
    if (header) {
      pushCurrent();
      current = {
        title: header.title,
        date: date || today,
        time: header.time,
        type: header.type,
        preacherName: "",
        place: header.place,
        items: [],
        announcements: [],
      };
      continue;
    }

    const place = readPlaceLine(raw);
    if (place && current) {
      current.place = place;
      continue;
    }

    if (/^인도(?:\s|및)/.test(raw) && current) {
      const name = bulletinPersonName(`축도 ${raw.replace(/^인도(?:\s*및\s*말씀)?\s*[:：]?\s*/, "")}`, people);
      if (name) current.preacherName = name;
      continue;
    }

    if (!current) {
      if (isLooseLyric(raw)) skippedLyrics += 1;
      continue;
    }

    if (inAnnouncements && isBullet(raw)) {
      const text = stripBullet(raw).slice(0, 500);
      if (text) current.announcements.push(text);
      continue;
    }

    const parsed = parseItem(raw, people);
    if (parsed.lyric) skippedLyrics += 1;
    if (!parsed.item) continue;
    if (parsed.item.kind === "announcement") inAnnouncements = true;
    else inAnnouncements = false;
    if (parsed.item.kind === "sermon" && parsed.item.personName) current.preacherName = parsed.item.personName;
    current.items.push(parsed.item);
  }
  pushCurrent();
  return { services, skippedLyrics };
}

function parseItem(raw: string, people: Person[]): { item: BulletinItem | null; lyric: boolean } {
  const line = raw.replace(/^\d+\s*[.)]\s*/, "").trim();
  const name = bulletinPersonName(line, people);
  const hymn = line.match(/^찬송\s*(\d+)\s*장\s*(.*)$/);
  if (hymn) {
    const title = shortenTitle(name ? stripPersonMention(hymn[2], name) : hymn[2].trim());
    return {
      lyric: title.dropped,
      item: blank("hymn", "찬송", { personName: name, hymnNumber: hymn[1], songTitle: title.value }),
    };
  }
  if (/^묵도/.test(line)) return { item: blank("meditation", "묵도"), lyric: false };
  if (/^사도신경/.test(line)) return { item: blank("creed", "사도신경"), lyric: false };
  if (/^신앙고백/.test(line)) return { item: blank("creed", "신앙고백"), lyric: false };
  const praise = line.match(/^찬양\s*(.*)$/);
  if (praise) {
    const title = shortenTitle(name ? stripPersonMention(praise[1], name) : praise[1].trim());
    return { lyric: title.dropped, item: blank("praise", "찬양", { personName: name, songTitle: title.value }) };
  }
  if (/^통성기도/.test(line)) return { item: blank("prayer", "통성기도", { personName: name }), lyric: false };
  if (/^(대표기도|기도)/.test(line)) {
    const title = line.startsWith("대표기도") ? "대표기도" : "기도";
    return { item: blank("prayer", title, { personName: name }), lyric: false };
  }
  const scripture = line.match(/^성경봉독\s*(.*)$/);
  if (scripture) {
    const passage = (name ? stripPersonMention(scripture[1], name) : scripture[1].trim()).slice(0, 120);
    return { item: blank("scripture", "성경봉독", { personName: name, scripture: passage }), lyric: false };
  }
  const choir = line.match(/^성가(?:대)?\s*(.*)$/);
  if (choir) {
    const title = shortenTitle(name ? stripPersonMention(choir[1], name) : choir[1].trim());
    return { lyric: title.dropped, item: blank("choir", "성가", { personName: name, songTitle: title.value, note: title.value }) };
  }
  const sermon = line.match(/^(설교|말씀)\s*(.*)$/);
  if (sermon) {
    const note = (name ? stripPersonMention(sermon[2], name) : sermon[2].trim()).slice(0, 80);
    return { item: blank("sermon", sermon[1] === "말씀" ? "말씀" : "설교", { personName: name, note }), lyric: false };
  }
  if (/^봉헌/.test(line)) return { item: blank("offering", "봉헌", { personName: name }), lyric: false };
  if (/^광고/.test(line)) return { item: blank("announcement", "광고"), lyric: false };
  if (/^축도/.test(line)) return { item: blank("benediction", "축도", { personName: name }), lyric: false };
  return { item: null, lyric: isLooseLyric(line) };
}

function blank(kind: ItemKind, title: string, extra: Partial<BulletinItem> = {}): BulletinItem {
  return {
    kind,
    title,
    note: "",
    scripture: "",
    personName: "",
    hymnNumber: "",
    songTitle: "",
    ...extra,
  };
}

function shortenTitle(value: string): { value: string; dropped: boolean } {
  const title = value.replace(/\s+/g, " ").trim();
  if (title.length > 18) return { value: "", dropped: true };
  return { value: title, dropped: false };
}

function isLooseLyric(line: string): boolean {
  const stripped = line.replace(/^\d+\s*[.)]\s*/, "").trim();
  return stripped.length > 18 && !ITEM_START.test(stripped);
}

function isBullet(line: string): boolean {
  return /^[-•·*–]\s*\S/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[-•·*–]\s*/, "").trim();
}

function readDate(line: string): string {
  const match = line.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!match) return "";
  const iso = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return isISODate(iso) ? iso : "";
}

function isDateLine(line: string): boolean {
  if (!/^\d{4}\s*년/.test(line)) return false;
  const rest = line.replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/, "").replace(/[()주일월화수목금토요.\s]/g, "");
  return rest.length === 0;
}

const SERVICE_TOKENS = new Set(["주일", "예배", "새벽", "수요", "금요", "특별", "기도회"]);

function readPlaceLine(line: string): string {
  const match = line.match(/^(?:예배\s*)?장\s*소\s*[:：]?\s*(.*)$/);
  if (!match) return "";
  return cleanPlace(match[1]);
}

function placeFromHeader(line: string): string {
  const paren = line.match(/[（(]\s*([^()（）]{1,40})\s*[)）]/);
  if (paren) {
    const place = cleanPlace(paren[1]);
    if (place && !SERVICE_TOKENS.has(place)) return place;
  }
  const stripped = line
    .replace(/[（(][^()（）]*[)）]/g, " ")
    .replace(/(오전|오후)\s*\d{1,2}\s*(?:[:시]\s*\d{1,2}\s*분?)?/g, " ")
    .replace(/\d{1,2}:\d{2}/g, " ")
    .replace(/[1-3]\s*부/g, " ");
  const tokens = stripped
    .split(/\s+/)
    .map((token) => token.replace(/^[·•,，|/~\-–]+|[·•,，|/~\-–]+$/g, ""))
    .filter((token) => token && !SERVICE_TOKENS.has(token));
  return cleanPlace(tokens.join(" "));
}

function cleanPlace(value: string): string {
  const place = value.replace(/\s+/g, " ").trim();
  if (!place || place.length > 40 || /(?:찬양예배|기도회|주일예배)$/.test(place.replace(/\s/g, ""))) return "";
  return place;
}

function parseHeader(line: string): { type: ServiceType; time: string; title: string; place: string } | null {
  if (line.length > 40) return null;
  if (hasTwoServiceParts(line)) return null;
  let type: ServiceType | null = null;
  let title = "";
  const part = line.match(/([1-3])\s*부/);
  if (/주일\s*찬양\s*예배/.test(line)) {
    type = "sunday-3";
    title = "주일찬양예배";
  } else if (part && /예배|오전|오후|\d{1,2}\s*:\s*\d{2}/.test(line)) type = `sunday-${part[1]}` as ServiceType;
  else if (line.includes("새벽")) type = "dawn";
  else if (/수요\s*기도회/.test(line)) {
    type = "wednesday";
    title = "수요기도회";
  } else if (line.includes("수요")) type = "wednesday";
  else if (line.includes("금요")) type = "friday";
  else if (line.includes("특별")) type = "special";
  else if (/(주일\s*예배|주일예배)/.test(line)) type = "sunday-2";
  else return null;
  const defaults = serviceTypeDefaults(type);
  return { type, time: parseClock(line) ?? defaults.time, title: title || defaults.title, place: placeFromHeader(line) };
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
