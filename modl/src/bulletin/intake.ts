/**
 * 붙여 넣은 주보 글을 칸으로 나눕니다.
 * 글에 없는 제목이나 이름은 만들지 않습니다.
 */

import type { BulletinBlock } from "@/bulletin/blocks";

export const BULLETIN_UPLOAD_BYTES = 16 * 1024 * 1024;

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
];

export function bulletinAccept(): string {
  return ACCEPT.join(",");
}

export function bulletinFormatNote(): string {
  return "직접 적거나 붙여 넣은 글, 텍스트, 워드, 한글, PDF, RTF, ODT, HTML, 사진을 받습니다.";
}

export type IntakeFields = {
  worshipDate: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocks: BulletinBlock[];
};

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

export function fieldsFromBulletinText(text: string, nextId: () => string): IntakeFields | null {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let date = "";
  let items: Item[] = [];
  let announcements: string[] = [];
  let news: string[] = [];
  let open = false;
  let inAnnouncements = false;
  let inNews = false;

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
        if (body && !isPhoneLine(body)) news.push(body);
        continue;
      }
      inNews = false;
    }
    if (isServiceHeader(raw)) {
      if (items.length === 0) {
        items = [];
        announcements = [];
      } else if (open && items.length > 0) {
        break;
      }
      open = true;
      inAnnouncements = false;
      continue;
    }
    if (!open) continue;
    if (inAnnouncements && isBullet(raw)) {
      const body = stripBullet(raw).slice(0, 500);
      if (body) announcements.push(body);
      continue;
    }
    const item = parseItem(raw);
    if (!item) continue;
    if (item.kind === "announcement") inAnnouncements = true;
    else inAnnouncements = false;
    items.push(item);
  }
  if (items.length === 0) return null;
  for (const body of news) {
    if (announcements.length >= 30) break;
    if (!announcements.includes(body)) announcements.push(body);
  }

  const sermon = items.find((item) => item.kind === "sermon");
  const scripture = items.find((item) => item.kind === "scripture");
  const leader = items.find((item) => item.title === "인도" && item.person);
  const blocks: BulletinBlock[] = [];
  const orderId = nextId();
  blocks.push({
    id: orderId,
    type: "order",
    items: items
      .filter((item) => item.kind !== "announcement")
      .slice(0, 40)
      .map((item) => ({
        id: nextId(),
        label: item.title.slice(0, 200),
        detail: orderDetail(item).slice(0, 500),
      })),
  });
  if (sermon) {
    blocks.push({
      id: nextId(),
      type: "sermon",
      title: sermon.detail.slice(0, 200),
      scripture: (scripture?.scripture ?? "").slice(0, 500),
      preacher: (sermon.person || leader?.person || "").slice(0, 120),
    });
  }
  const officers = items.filter((item) => item.kind === "officer" && item.person);
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
  const songs = items.filter((item) => item.kind === "hymn" || item.kind === "praise");
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
  if (announcements.length > 0) {
    blocks.push({
      id: nextId(),
      type: "announcement",
      body: announcements.join("\n").slice(0, 4000),
    });
  }
  return {
    worshipDate: date,
    sermonTitle: (sermon?.detail ?? "").slice(0, 200),
    scriptureText: (scripture?.scripture ?? "").slice(0, 500),
    preacher: (sermon?.person || leader?.person || "").slice(0, 120),
    blocks,
  };
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

function parseItem(raw: string): Item | null {
  const line = raw.replace(/^\d+\s*[.)]\s*/, "").trim();
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

function isServiceHeader(line: string): boolean {
  if (line.length > 40 || /^[-•·*–]/.test(line) || /^\d+\s*[.)]/.test(line)) return false;
  if (/주일\s*찬양\s*예배|주일\s*예배|주일예배|수요\s*기도회|새벽|금요|특별/.test(line)) return true;
  return /[1-3]\s*부/.test(line) && /예배|오전|오후|\d{1,2}\s*:\s*\d{2}/.test(line);
}

function isBullet(line: string): boolean {
  return /^[-•·*–]\s*\S/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^[-•·*–]\s*/, "").trim();
}

function isPhoneLine(text: string): boolean {
  return /\d{2,4}[)\-\s.]?\d{3,4}[-\s.]\d{4}/.test(text);
}
