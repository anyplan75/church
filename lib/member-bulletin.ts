/** 성도용 주보·가사·예배 정보 도우미 (Firebase services/songs 재사용). */

import { formatKoreanDate, formatTime } from "./format";
import { slidesFor, type Slide } from "./slides";
import type { Db, Person, Service, Song } from "./types";
import { itemAside, preacherName, todayISO } from "./worship";

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

const SONG_KINDS = new Set(["hymn", "praise", "choir"]);

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

export function memberServiceOptions(services: Service[], today = todayISO()): Service[] {
  const upcoming = sortServices(services.filter((item) => item.date >= today || item.status === "live")).slice(0, 12);
  if (upcoming.length > 0) return upcoming;
  return sortServices(services).slice(-8).reverse();
}

export function buildMemberBulletin(service: Service, people: Person[], songs: Song[], churchName: string): MemberBulletinView {
  const sermon = service.items.find((item) => item.kind === "sermon");
  return {
    churchName: churchName.trim() || "은혜로운 예배",
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

export function memberViewsFromDb(db: Db, selectedId = "", today = todayISO()) {
  const pick = pickMemberService(db.services, selectedId, today);
  if (!pick) {
    return {
      pick: null as MemberServicePick | null,
      options: [] as Service[],
      bulletin: null as MemberBulletinView | null,
      lyrics: [] as MemberLyricLine[],
      info: null as ReturnType<typeof memberWorshipInfo> | null,
    };
  }
  const { service } = pick;
  return {
    pick,
    options: memberServiceOptions(db.services, today),
    bulletin: buildMemberBulletin(service, db.people, db.songs, db.settings.churchName),
    lyrics: memberLyricsFor(service, db.people, db.songs),
    info: memberWorshipInfo(service, db.people, db.songs, db.settings.churchName),
  };
}

export function pickReasonLabel(reason: MemberServicePick["reason"]): string {
  if (reason === "live") return "지금 진행 중";
  if (reason === "today") return "오늘 예배";
  if (reason === "next") return "다가오는 예배";
  if (reason === "selected") return "선택한 예배";
  return "최근 예배";
}
