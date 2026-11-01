/**
 * 열린 안뜨레 블록, 디자인, 검색 노출, 공개 경로입니다.
 * 데이터베이스에 접속하지 않습니다.
 */

import type { Actor } from "@/server/auth/actor";
import { can } from "@/server/auth/rbac";

export const WEBSITE_BLOCK_TYPES = [
  "intro_profile",
  "intro_body",
  "intro_album",
  "intro_video",
  "intro_banner",
  "visit_times",
  "visit_map",
  "visit_faq",
  "visit_inquiry",
  "news_notice",
  "news_dday",
  "news_popup",
  "news_files",
  "news_social",
  "link_bulletin",
  "link_calendar",
  "link_survey",
] as const;

export type WebsiteBlockType = (typeof WEBSITE_BLOCK_TYPES)[number];

export const LINK_BLOCK_TYPES = ["link_bulletin", "link_calendar", "link_survey"] as const;

export type WebsitePlan = "FREE" | "PRO";

export type FaqItem = { question: string; answer: string };
export type SocialLink = { label: string; url: string };

export type WebsiteBlock = {
  id: string;
  type: WebsiteBlockType;
  title: string;
  body: string;
  photoUrl: string;
  photoUrls: string[];
  videoUrl: string;
  imageUrl: string;
  linkUrl: string;
  address: string;
  targetDate: string;
  fileUrls: string[];
  faqs: FaqItem[];
  socials: SocialLink[];
  surveyId: string;
};

export type WebsiteTheme = {
  font: "sans" | "serif" | "rounded";
  background: string;
  button: "square" | "rounded" | "pill";
};

export type WebsiteSeo = {
  title: string;
  description: string;
  imageUrl: string;
  indexable: boolean;
};

export type LinkedBulletin = {
  title: string;
  worshipDate: string;
  href: string;
};

export type LinkedEvent = {
  id: string;
  title: string;
  startAt: string;
};

export type LinkedSurvey = {
  id: string;
  title: string;
  href: string;
};

export const DEFAULT_THEME: WebsiteTheme = {
  font: "sans",
  background: "#f4efe4",
  button: "rounded",
};

export const DEFAULT_SEO: WebsiteSeo = {
  title: "",
  description: "",
  imageUrl: "",
  indexable: true,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isLinkBlock(type: string): boolean {
  return (LINK_BLOCK_TYPES as readonly string[]).includes(type);
}

/** 무료 등급은 앱 연동 블록을 공개 페이지에서 뺍니다. */
export function blocksForPublic(blocks: readonly WebsiteBlock[], plan: WebsitePlan): WebsiteBlock[] {
  if (plan === "PRO") return [...blocks];
  return blocks.filter((block) => !isLinkBlock(block.type));
}

export function canEditWebsite(actor: Actor, communityId: string): boolean {
  return can(actor, { type: "manage_website", communityId });
}

export function robotsForSeo(indexable: boolean): { index: boolean; follow: boolean } {
  if (indexable) return { index: true, follow: true };
  return { index: false, follow: false };
}

/** `/@주소` 를 실제 공개 경로로 바꿉니다. 다른 주소는 그대로 둡니다. */
export function rewriteAtPath(pathname: string): string | null {
  const match = pathname.match(/^\/@([^/]+)$/);
  if (!match) return null;
  let slug = match[1] ?? "";
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return null;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return `/site/${slug}`;
}

export function publicSitePath(slug: string): string {
  return `/site/${slug}`;
}

export function atSitePath(slug: string): string {
  return `/@${slug}`;
}

export function moveWebsiteBlock(blocks: readonly WebsiteBlock[], index: number, direction: -1 | 1): WebsiteBlock[] {
  const next = index + direction;
  if (index < 0 || index >= blocks.length || next < 0 || next >= blocks.length) return [...blocks];
  const copy = [...blocks];
  const current = copy[index];
  const swapped = copy[next];
  if (!current || !swapped) return [...blocks];
  copy[index] = swapped;
  copy[next] = current;
  return copy;
}

export function emptyBlock(type: WebsiteBlockType, id: string): WebsiteBlock {
  return {
    id,
    type,
    title: "",
    body: "",
    photoUrl: "",
    photoUrls: [],
    videoUrl: "",
    imageUrl: "",
    linkUrl: "",
    address: "",
    targetDate: "",
    fileUrls: [],
    faqs: [],
    socials: [],
    surveyId: "",
  };
}

function textLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseTheme(input: unknown): WebsiteTheme {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const font = source.font === "serif" || source.font === "rounded" || source.font === "sans" ? source.font : DEFAULT_THEME.font;
  const background = typeof source.background === "string" && HEX.test(source.background) ? source.background : DEFAULT_THEME.background;
  const button =
    source.button === "square" || source.button === "pill" || source.button === "rounded" ? source.button : DEFAULT_THEME.button;
  return { font, background, button };
}

export function parseSeo(input: unknown): WebsiteSeo {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const imageUrl = typeof source.imageUrl === "string" && isHttpUrl(source.imageUrl.trim()) ? source.imageUrl.trim() : "";
  return {
    title: typeof source.title === "string" ? source.title.trim().slice(0, 120) : "",
    description: typeof source.description === "string" ? source.description.trim().slice(0, 300) : "",
    imageUrl,
    indexable: source.indexable !== false,
  };
}

function stringField(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 40);
}

function pairList(value: unknown, left: "question" | "label", right: "answer" | "url"): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  const rows: Array<Record<string, string>> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const a = stringField(record[left], 200);
    const b = stringField(record[right], 1000);
    if (!a && !b) continue;
    rows.push({ [left]: a, [right]: b });
    if (rows.length >= 40) break;
  }
  return rows;
}

export function parseBlocks(input: unknown): { ok: true; blocks: WebsiteBlock[] } | { ok: false; message: string } {
  if (!Array.isArray(input)) return { ok: false, message: "블록 목록 모양이 맞지 않습니다." };
  if (input.length > 40) return { ok: false, message: "블록은 40개까지 둘 수 있습니다." };
  const blocks: WebsiteBlock[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return { ok: false, message: "블록 모양이 맞지 않습니다." };
    const record = item as Record<string, unknown>;
    const type = record.type;
    if (typeof type !== "string" || !(WEBSITE_BLOCK_TYPES as readonly string[]).includes(type)) {
      return { ok: false, message: "알 수 없는 블록이 있습니다." };
    }
    const id = stringField(record.id, 80);
    if (!id) return { ok: false, message: "블록 번호가 비어 있습니다." };
    const block = emptyBlock(type as WebsiteBlockType, id);
    block.title = stringField(record.title, 200);
    block.body = stringField(record.body, 4000);
    block.photoUrl = stringField(record.photoUrl, 1000);
    block.photoUrls = stringList(record.photoUrls);
    block.videoUrl = stringField(record.videoUrl, 1000);
    block.imageUrl = stringField(record.imageUrl, 1000);
    block.linkUrl = stringField(record.linkUrl, 1000);
    block.address = stringField(record.address, 300);
    block.targetDate = stringField(record.targetDate, 10);
    block.fileUrls = stringList(record.fileUrls);
    block.faqs = pairList(record.faqs, "question", "answer") as FaqItem[];
    block.socials = pairList(record.socials, "label", "url") as SocialLink[];
    block.surveyId = stringField(record.surveyId, 80);
    if (block.photoUrl && !isHttpUrl(block.photoUrl) && !block.photoUrl.startsWith("/")) {
      return { ok: false, message: "사진 주소는 http 로 시작하거나 / 로 시작하는 경로여야 합니다." };
    }
    for (const url of [...block.photoUrls, ...block.fileUrls, block.videoUrl, block.imageUrl, block.linkUrl]) {
      if (url && !isHttpUrl(url) && !url.startsWith("/")) {
        return { ok: false, message: "주소는 http 로 시작하거나 / 로 시작하는 경로여야 합니다." };
      }
    }
    for (const social of block.socials) {
      if (social.url && !isHttpUrl(social.url)) {
        return { ok: false, message: "소셜 주소는 http 로 시작해 주세요." };
      }
    }
    if (block.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(block.targetDate)) {
      return { ok: false, message: "행사 날짜를 확인해 주세요." };
    }
    blocks.push(block);
  }
  return { ok: true, blocks };
}

export function parseBlocksJson(raw: string): { ok: true; blocks: WebsiteBlock[] } | { ok: false; message: string } {
  try {
    return parseBlocks(JSON.parse(raw));
  } catch {
    return { ok: false, message: "블록 목록 모양이 맞지 않습니다." };
  }
}

export function linesToList(raw: string): string[] {
  return textLines(raw);
}

export function linesToFaqs(raw: string): FaqItem[] {
  return textLines(raw).map((line) => {
    const [question, ...rest] = line.split("|");
    return { question: (question ?? "").trim(), answer: rest.join("|").trim() };
  });
}

export function linesToSocials(raw: string): SocialLink[] {
  return textLines(raw).map((line) => {
    const [label, ...rest] = line.split("|");
    return { label: (label ?? "").trim(), url: rest.join("|").trim() };
  });
}

export type BulletinPick = {
  id: string;
  worshipDate: string;
  sermonTitle: string;
  isPublic: boolean;
  shareToken: string | null;
};

/** 공개된 주일 기별 가운데 예배 날짜가 가장 늦은 것을 고릅니다. */
export function pickLatestPublicBulletin(rows: readonly BulletinPick[]): BulletinPick | null {
  const opened = rows.filter((row) => row.isPublic && row.shareToken);
  opened.sort((left, right) => right.worshipDate.localeCompare(left.worshipDate));
  return opened[0] ?? null;
}

export type EventPick = {
  id: string;
  title: string;
  startAt: string;
  category: string;
  isLeaderOnly: boolean;
  communityId: string;
};

/** 생일과 공휴일, 리더 일정, 지난 일정, 다른 공동체 일정은 뺍니다. */
export function upcomingPublicEvents(rows: readonly EventPick[], communityId: string, nowIso: string): EventPick[] {
  return rows
    .filter((row) => row.communityId === communityId)
    .filter((row) => !row.isLeaderOnly)
    .filter((row) => row.category !== "BIRTHDAY" && row.category !== "HOLIDAY")
    .filter((row) => row.startAt >= nowIso)
    .sort((left, right) => left.startAt.localeCompare(right.startAt))
    .slice(0, 8);
}

export function daysUntil(targetDate: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const target = Date.parse(`${targetDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(target) || Number.isNaN(now)) return null;
  return Math.round((target - now) / 86400000);
}

export function parseInquiry(input: {
  visitorName: string;
  visitorContact: string;
  message: string;
}): { ok: true; visitorName: string; visitorContact: string; message: string } | { ok: false; message: string } {
  const visitorName = input.visitorName.trim();
  const visitorContact = input.visitorContact.trim();
  const message = input.message.trim();
  if (!visitorName || visitorName.length > 80) return { ok: false, message: "이름을 적어 주세요." };
  if (!visitorContact || visitorContact.length > 120) return { ok: false, message: "연락처를 적어 주세요." };
  if (!message || message.length > 4000) return { ok: false, message: "문의 내용을 적어 주세요." };
  return { ok: true, visitorName, visitorContact, message };
}

/** 푸시 열쇠 이름이 비어 있으면 앱 안 알림만 합니다. */
export function inquiryPushReady(env: { INQUIRY_PUSH_KEY?: string }): boolean {
  return Boolean(env.INQUIRY_PUSH_KEY?.trim());
}
