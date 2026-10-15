import type { Person, Service, Song } from "./types";
import { kindLabel, personName } from "./worship";
import { slidesFor } from "./slides";

export type DeskGroup = {
  itemId: string;
  index: number;
  label: string;
  start: number;
  count: number;
};

export type DeskSlide = {
  itemId: string;
  groupIndex: number;
  groupLabel: string;
  inGroup: number;
  flat: number;
  kicker: string;
  heading: string;
  reference: string;
  lines: string[];
};

export const SLIDE_KEYS = [
  { keys: "→  ↓  Space", action: "다음 슬라이드" },
  { keys: "←  ↑", action: "이전 슬라이드" },
  { keys: "]  또는 Ctrl+↓", action: "다음 그룹" },
  { keys: "[  또는 Ctrl+↑", action: "이전 그룹" },
  { keys: "Home", action: "처음 슬라이드" },
  { keys: "End", action: "마지막 슬라이드" },
  { keys: "1–9", action: "그 번호의 그룹으로 건너뛰기" },
] as const;

export function buildDesk(service: Service, people: Person[], songs: Song[], localSlides: Record<string, string[]> = {}): { groups: DeskGroup[]; slides: DeskSlide[] } {
  const base = slidesFor(service, people, songs);
  const groups: DeskGroup[] = [];
  const slides: DeskSlide[] = [];
  service.items.forEach((item, index) => {
    const slide = base[index];
    const song = item.songId ? songs.find((entry) => entry.id === item.songId) : undefined;
    const reference = [item.scripture, song?.hymnNumber ? `${song.hymnNumber}장` : "", personName(people, item.personId)].filter(Boolean).join(" · ");
    const chunks = (localSlides[item.id] ?? []).map((chunk) => chunk.trim()).filter(Boolean).slice(0, 40);
    const bodies = chunks.length > 0 ? chunks : [""];
    const start = slides.length;
    bodies.forEach((body, inGroup) => {
      slides.push({
        itemId: item.id,
        groupIndex: index,
        groupLabel: item.title || kindLabel(item.kind),
        inGroup,
        flat: start + inGroup,
        kicker: slide?.kicker || kindLabel(item.kind),
        heading: slide?.heading || item.title,
        reference,
        lines: body ? body.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2) : [],
      });
    });
    groups.push({ itemId: item.id, index, label: item.title || kindLabel(item.kind), start, count: bodies.length });
  });
  return { groups, slides };
}

export function groupStart(groups: DeskGroup[], groupIndex: number): number {
  return groups.find((group) => group.index === groupIndex)?.start ?? 0;
}
