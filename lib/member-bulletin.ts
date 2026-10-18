/** 성도용 주보·가사·예배 정보·자막 도우미 (Firebase services/songs 재사용). */

import { formatKoreanDate, formatTime } from "./format";
import { slidesFor, type Slide } from "./slides";
import type { Db, ItemKind, Person, Service, Song, WorshipItem } from "./types";
import { clampLiveIndex, itemAside, kindLabel, preacherName, todayISO } from "./worship";

export type MemberServicePick = {
  service: Service;
  reason: "live" | "today" | "next" | "selected" | "recent";
};

export type MemberBulletinView = {
  churchName: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  place: string;
  preacher: string;
  sermonTitle: string;
  scripture: string;
  order: { id: string; title: string; aside: string; note: string }[];
  notices: { id: string; text: string }[];
  notes: string;
};

export type MemberLyricLine = {
  itemId: string;
  kicker: string;
  heading: string;
  lines: string[];
  footer: string;
  isSong: boolean;
};

/** 예배 중 성도 폰에 크게 보여주는 자막 한 장면. */
export type MemberLiveCaption = {
  mode: "praise" | "word" | "other" | "idle";
  kicker: string;
  heading: string;
  lines: string[];
  footer: string;
  orderTitle: string;
  orderIndex: number;
  orderTotal: number;
  live: boolean;
  source: "output" | "slide" | "item" | "none";
};

const SONG_KINDS = new Set<ItemKind>(["hymn", "praise", "choir"]);
const WORD_KINDS = new Set<ItemKind>(["sermon", "scripture"]);

function sortServices(list: Service[]): Service[] {
  return list
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title, "ko"));
}

/** 오늘·진행 중·다가오는 예배를 고릅니다. selectedId가 있으면 그걸 우선합니다. */
export function pickMemberService(services: Service[], selectedId = "", today = todayISO()): MemberServicePick | null {
  const list = Array.isArray(services) ? services : [];
  if (selectedId) {
    const selected = list.find((item) => item.id === selectedId);
    if (selected) return { service: selected, reason: "selected" };
  }
  const live = list.find((item) => item.status === "live");
  if (live) return { service: live, reason: "live" };

  const todayList = sortServices(list.filter((item) => item.date === today && item.status !== "done"));
  if (todayList[0]) return { service: todayList[0], reason: "today" };

  const upcoming = sortServices(list.filter((item) => item.date >= today && item.status !== "done"));
  if (upcoming[0]) return { service: upcoming[0], reason: "next" };

  const recent = sortServices(list).reverse()[0];
  return recent ? { service: recent, reason: "recent" } : null;
}

/**
 * 성도가 고를 예배 목록.
 * 같은 날 청소년부·청년부처럼 주보가 다른 여러 예배를 모두 보이게 합니다.
 */
export function memberServiceOptions(services: Service[], today = todayISO()): Service[] {
  const list = Array.isArray(services) ? services : [];
  const liveOrUpcoming = sortServices(
    list.filter((item) => item.status === "live" || (item.date >= today && item.status !== "done")),
  );
  if (liveOrUpcoming.length > 0) {
    // 같은 날·가까운 날의 부서 예배를 넉넉히 보여 줍니다.
    return liveOrUpcoming.slice(0, 24);
  }
  return sortServices(list).slice(-16).reverse();
}

export function serviceOptionLabel(service: Service): string {
  const status =
    service.status === "live" ? "진행 중 · " : service.status === "done" ? "마침 · " : "";
  return `${status}${service.date} ${service.time} · ${service.title}`;
}

export function buildMemberBulletin(service: Service, people: Person[], songs: Song[], churchName: string): MemberBulletinView {
  const sermon = service.items.find((item) => item.kind === "sermon");
  return {
    churchName: churchName.trim() || "우리 교회",
    title: service.title,
    dateLabel: formatKoreanDate(service.date),
    timeLabel: formatTime(service.time),
    place: service.place || "본당",
    preacher: preacherName(service, people),
    sermonTitle: sermon?.note.trim() || "",
    scripture: sermon?.scripture.trim() || "",
    order: service.items.map((item) => ({
      id: item.id,
      title: item.title,
      aside: itemAside(item, people, songs),
      note: item.kind === "sermon" ? "" : item.note.trim(),
    })),
    notices: service.announcements.filter((row) => row.text.trim()).map((row) => ({ id: row.id, text: row.text.trim() })),
    notes: service.notes?.trim() || "",
  };
}

/** 송출 슬라이드 자료를 성도용 가사·문구 목록으로 바꿉니다. 허가된 한 줄만 가사로 둡니다. */
export function memberLyricsFor(service: Service, people: Person[], songs: Song[]): MemberLyricLine[] {
  const slides: Slide[] = slidesFor(service, people, songs);
  return slides.map((slide, index) => {
    const item = service.items[index];
    const isSong = Boolean(item && SONG_KINDS.has(item.kind));
    return {
      itemId: slide.itemId,
      kicker: slide.kicker,
      heading: slide.heading,
      lines: slide.lines,
      footer: slide.footer,
      isSong,
    };
  });
}

export function memberWorshipInfo(service: Service, people: Person[], songs: Song[], churchName: string) {
  const bulletin = buildMemberBulletin(service, people, songs, churchName);
  return {
    ...bulletin,
    status: service.status,
    type: service.type,
    liveIndex: service.liveIndex,
    currentTitle: service.items[service.liveIndex]?.title || "",
  };
}

function captionModeFor(kind: ItemKind | undefined): MemberLiveCaption["mode"] {
  if (!kind) return "idle";
  if (SONG_KINDS.has(kind)) return "praise";
  if (WORD_KINDS.has(kind)) return "word";
  return "other";
}

function itemFallbackLines(item: WorshipItem): string[] {
  const lines: string[] = [];
  if (item.kind === "sermon") {
    if (item.scripture.trim()) lines.push(item.scripture.trim());
    if (item.scriptureLicensed && item.scriptureText.trim()) lines.push(item.scriptureText.trim().slice(0, 400));
    else if (item.note.trim()) lines.push(item.note.trim());
  } else if (item.kind === "scripture") {
    if (item.scripture.trim()) lines.push(item.scripture.trim());
    if (item.scriptureLicensed && item.scriptureText.trim()) lines.push(item.scriptureText.trim().slice(0, 400));
  } else if (item.note.trim()) {
    lines.push(item.note.trim());
  }
  return lines.filter(Boolean).slice(0, 4);
}

/**
 * 진행 중 예배의 현재 순서에 맞춰 자막 장면을 만듭니다.
 * 조작 리모컨이 남긴 outputLines가 있으면 그걸 우선합니다.
 */
export function memberLiveCaption(service: Service, people: Person[], songs: Song[]): MemberLiveCaption {
  const slides = slidesFor(service, people, songs);
  const orderTotal = service.items.length;
  if (orderTotal === 0) {
    return {
      mode: "idle",
      kicker: "",
      heading: service.title,
      lines: [],
      footer: "예배 순서가 없습니다",
      orderTitle: "",
      orderIndex: 0,
      orderTotal: 0,
      live: service.status === "live",
      source: "none",
    };
  }

  const orderIndex = clampLiveIndex(service.liveIndex, orderTotal);
  const item = service.items[orderIndex];
  const slide = slides[orderIndex] ?? null;
  const mode = captionModeFor(item?.kind);
  const output = (service.outputLines || []).map((line) => line.trim()).filter(Boolean);

  let lines: string[] = [];
  let source: MemberLiveCaption["source"] = "none";
  if (output.length > 0) {
    lines = output.slice(0, 4);
    source = "output";
  } else if (slide?.lines.length) {
    lines = slide.lines.slice(0, 4);
    source = "slide";
  } else if (item) {
    lines = itemFallbackLines(item);
    source = lines.length ? "item" : "none";
  }

  return {
    mode,
    kicker: item ? kindLabel(item.kind) : "",
    heading: slide?.heading || item?.title || service.title,
    lines,
    footer: slide?.footer || "",
    orderTitle: item?.title || "",
    orderIndex,
    orderTotal,
    live: service.status === "live",
    source,
  };
}

export function memberViewsFromDb(db: Db, selectedId = "", today = todayISO()) {
  const pick = pickMemberService(db.services, selectedId, today);
  if (!pick) {
    return {
      pick: null as MemberServicePick | null,
      options: [] as Service[],
      bulletin: null as MemberBulletinView | null,
      lyrics: [] as MemberLyricLine[],
      info: null as ReturnType<typeof memberWorshipInfo> | null,
      notices: [] as { id: string; text: string }[],
      caption: null as MemberLiveCaption | null,
    };
  }
  const { service } = pick;
  const bulletin = buildMemberBulletin(service, db.people, db.songs, db.settings.churchName);
  return {
    pick,
    options: memberServiceOptions(db.services, today),
    bulletin,
    lyrics: memberLyricsFor(service, db.people, db.songs),
    info: memberWorshipInfo(service, db.people, db.songs, db.settings.churchName),
    notices: bulletin.notices,
    caption: memberLiveCaption(service, db.people, db.songs),
  };
}

export function pickReasonLabel(reason: MemberServicePick["reason"]): string {
  if (reason === "live") return "지금 진행 중";
  if (reason === "today") return "오늘 예배";
  if (reason === "next") return "다가오는 예배";
  if (reason === "selected") return "선택한 예배";
  return "최근 예배";
}

export function captionModeHint(mode: MemberLiveCaption["mode"]): string {
  if (mode === "praise") return "찬양 · 가사 자막";
  if (mode === "word") return "말씀 · 본문 자막";
  if (mode === "other") return "지금 순서";
  return "대기";
}
