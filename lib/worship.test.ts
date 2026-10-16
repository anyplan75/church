import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatKoreanDate, formatTime, relativeDay } from "./format.ts";
import type { Person, Service, Song } from "./types.ts";
import {
  addDays,
  assignmentProgress,
  clampLiveIndex,
  comingSunday,
  isISODate,
  itemAside,
  mondayOf,
  nextService,
  normalizeService,
  reorder,
  splitServices,
  templateItems,
  todayISO,
  weekServices,
} from "./worship.ts";

function service(partial: Partial<Service> & Pick<Service, "id" | "date">): Service {
  return {
    title: partial.title ?? "예배",
    time: partial.time ?? "11:00",
    type: partial.type ?? "sunday-2",
    place: partial.place ?? "본당",
    preacherId: partial.preacherId ?? null,
    status: partial.status ?? "planning",
    items: partial.items ?? [],
    announcements: partial.announcements ?? [],
    liveIndex: partial.liveIndex ?? 0,
    startedAt: partial.startedAt ?? null,
    notes: partial.notes ?? "",
    checks: partial.checks ?? {},
    source: partial.source ?? "manual",
    ...partial,
  };
}

describe("dates", () => {
  it("calculates the Monday and the coming Sunday", () => {
    assert.equal(mondayOf("2026-10-12"), "2026-10-12");
    assert.equal(mondayOf("2026-10-18"), "2026-10-12");
    assert.equal(comingSunday("2026-10-12"), "2026-10-18");
    assert.equal(comingSunday("2026-10-18"), "2026-10-18");
    assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  });

  it("uses the Seoul calendar day", () => {
    assert.equal(todayISO(new Date("2026-10-12T02:00:00Z")), "2026-10-12");
    assert.equal(todayISO(new Date("2026-10-12T15:30:00Z")), "2026-10-13");
  });

  it("rejects impossible dates and formats the rest", () => {
    assert.equal(isISODate("2026-02-31"), false);
    assert.equal(isISODate("2026-10-12"), true);
    assert.equal(formatKoreanDate("2026-10-12"), "2026년 10월 12일 (월)");
    assert.equal(formatTime("09:00"), "오전 9:00");
    assert.equal(formatTime("00:05"), "오전 12:05");
    assert.equal(formatTime("15:30"), "오후 3:30");
    assert.equal(relativeDay("2026-10-12", "2026-10-12"), "오늘");
    assert.equal(relativeDay("2026-10-13", "2026-10-12"), "내일");
  });
});

describe("order", () => {
  it("moves an item up and down without passing the ends", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(reorder(items, "b", -1).map((item) => item.id), ["b", "a", "c"]);
    assert.deepEqual(reorder(items, "a", -1).map((item) => item.id), ["a", "b", "c"]);
    assert.deepEqual(reorder(items, "c", 1).map((item) => item.id), ["a", "b", "c"]);
    assert.deepEqual(items.map((item) => item.id), ["a", "b", "c"]);
  });

  it("keeps the live index inside the order", () => {
    assert.equal(clampLiveIndex(-3, 4), 0);
    assert.equal(clampLiveIndex(9, 4), 3);
    assert.equal(clampLiveIndex(1, 0), 0);
  });

  it("builds a Sunday order with congregational and assigned parts", () => {
    const items = templateItems("sunday-2");
    assert.deepEqual(items.map((item) => item.kind), [
      "meditation",
      "hymn",
      "creed",
      "praise",
      "prayer",
      "scripture",
      "choir",
      "sermon",
      "offering",
      "announcement",
      "hymn",
      "benediction",
    ]);
    assert.equal(templateItems("dawn").length, 5);
    assert.equal(templateItems("friday")[4]?.title, "통성기도");
  });
});

describe("services", () => {
  const people: Person[] = [{ id: "p1", name: "김은혜", roles: ["담임목사"], phone: "", active: true }];
  const songs: Song[] = [{ id: "s1", title: "만복의 근원 하나님", hymnNumber: "1", key: "G", license: "title-only", permittedLine: "" }];

  it("splits live and finished services around today", () => {
    const services = [
      service({ id: "past", date: "2026-10-11", status: "done", time: "11:00" }),
      service({ id: "late", date: "2026-10-11", status: "live", time: "09:00" }),
      service({ id: "next", date: "2026-10-18", status: "ready", time: "11:00" }),
      service({ id: "early", date: "2026-10-18", status: "planning", time: "09:00" }),
    ];
    const split = splitServices(services, "2026-10-12");
    assert.deepEqual(split.upcoming.map((item) => item.id), ["late", "early", "next"]);
    assert.deepEqual(split.past.map((item) => item.id), ["past"]);
    assert.equal(nextService(services, "2026-10-12")?.id, "late");
    assert.deepEqual(weekServices(services, "2026-10-12").map((item) => item.id), ["late", "past"]);
  });

  it("counts missing leaders and describes a bulletin line", () => {
    const item = templateItems("sunday-1").map((entry, index) => ({ ...entry, id: String(index) }));
    item[1] = { ...item[1], songId: "s1" };
    item[7] = { ...item[7], personId: "p1", scripture: "이사야 40:28-31" };
    const current = service({ id: "sun", date: "2026-10-18", items: item });
    assert.equal(assignmentProgress(current).total, 8);
    assert.equal(assignmentProgress(current).assigned, 1);
    assert.equal(itemAside(item[0], people, songs), "다함께");
    assert.equal(itemAside(item[1], people, songs), "1장 만복의 근원 하나님");
    assert.equal(itemAside(item[7], people, songs), "김은혜");
  });

  it("normalizes an incomplete service", () => {
    const normalized = normalizeService({
      id: "svc",
      title: "  ",
      date: "2026-02-31",
      time: "99:00",
      type: "sunday-2",
      place: "",
      preacherId: "",
      status: "ready",
      items: [{ id: "", kind: "sermon", title: "", note: "", scripture: "요한복음 3:16", personId: "", songId: null }],
      announcements: [{ id: "a1", text: "  새가족 환영회  " }],
      liveIndex: 5,
      startedAt: null,
      notes: "",
      outputLines: ["  하나  ", "둘", "셋은 버려진다"],
    });
    assert.equal(normalized.title, "예배");
    assert.equal(normalized.date, todayISO());
    assert.equal(normalized.time, "11:00");
    assert.equal(normalized.place, "본당");
    assert.equal(normalized.preacherId, null);
    assert.equal(normalized.items[0]?.title, "설교");
    assert.equal(normalized.items[0]?.personId, null);
    assert.equal(normalized.liveIndex, 0);
    assert.equal(normalized.announcements[0]?.text, "  새가족 환영회  ");
    assert.deepEqual(normalized.outputLines, ["하나", "둘"]);
  });
});
