import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileMatchesQuery } from "./local-library.ts";
import { formatVisit, noteVisit, openVisit, orderLine, serviceText, settingsReady, setupComplete } from "./simple.ts";
import type { Person, Service, Settings, Song, WorshipItem } from "./types.ts";
import { sundayOf, weekServices } from "./worship.ts";

const settings = {
  churchName: "서귀포제일교회",
  backgroundColor: "#1b3a32",
  backgroundFile: null,
  overlay: "bottom",
  defaultPlace: "본당",
  folders: { bible: "성경", hymn: "찬송가", praise: "찬양" },
  groups: [{ id: "g1", name: "주일", personIds: ["p1"] }],
  mainReady: true,
  backgrounds: ["배경 1", "배경 2", "배경 3", "배경 4", "배경 5"],
} as Settings;

function item(partial: Partial<WorshipItem>): WorshipItem {
  return {
    id: partial.id ?? "item",
    kind: partial.kind ?? "other",
    title: partial.title ?? "",
    note: partial.note ?? "",
    scripture: partial.scripture ?? "",
    scriptureText: "",
    scriptureLicensed: false,
    screenCue: "",
    personId: partial.personId ?? null,
    pendingName: partial.pendingName ?? "",
    songId: partial.songId ?? null,
  };
}

describe("단순 운영", () => {
  it("한 주는 주일부터 토요일까지다", () => {
    assert.equal(sundayOf("2026-10-15"), "2026-10-11");
    assert.equal(sundayOf("2026-10-11"), "2026-10-11");
    const services = weekServices(
      [
        { id: "sun", date: "2026-10-11", time: "09:00", title: "주일" },
        { id: "wed", date: "2026-10-14", time: "19:00", title: "수요" },
        { id: "next", date: "2026-10-18", time: "09:00", title: "다음" },
      ] as never,
      "2026-10-15",
    );
    assert.deepEqual(services.map((service) => service.id), ["sun", "wed"]);
  });

  it("폴더와 그룹과 마침 표시가 있어야 예배를 시작한다", () => {
    assert.equal(setupComplete(settings), true);
    assert.equal(settingsReady(settings), true);
    assert.equal(settingsReady({ ...settings, mainReady: false }), false);
    assert.equal(setupComplete({ ...settings, folders: { bible: "", hymn: "찬송가", praise: "찬양" } }), false);
  });

  it("띄어쓰기가 달라도 찬송가와 찬양과 성경 파일을 찾는다", () => {
    assert.equal(fileMatchesQuery("찬송가 1장.txt", { kind: "hymn", title: "찬송", hymnNumber: "1", scripture: "" }), true);
    assert.equal(fileMatchesQuery("창세기.txt", { kind: "bible", title: "성경봉독", hymnNumber: "", scripture: "창세기 1:1" }), true);
    assert.equal(fileMatchesQuery("주 님 은 왕.txt", { kind: "praise", title: "주님은 왕", hymnNumber: "", scripture: "" }), true);
  });

  it("예배 순서에 장 번호와 찬양 제목과 인도자와 본문 제목과 광고를 남긴다", () => {
    const song: Song = { id: "s1", title: "주님의 마음을 본받는 자", hymnNumber: "455", key: "", license: "title-only", permittedLine: "" };
    const plain: Song = { id: "s2", title: "찬송 546장", hymnNumber: "546", key: "", license: "title-only", permittedLine: "" };
    const praise: Song = { id: "s3", title: "위드엘 찬양단", hymnNumber: "", key: "", license: "title-only", permittedLine: "" };
    const person: Person = { id: "p1", name: "이종찬", roles: ["목사"], phone: "", active: true, membership: "member", attendanceConsent: false };
    const hymn = item({ kind: "hymn", title: "찬송", songId: "s1" });
    const dawn = item({ kind: "hymn", title: "찬송", songId: "s2" });
    const choir = item({ kind: "praise", title: "찬양", songId: "s3" });
    const prayer = item({ kind: "prayer", title: "기도", pendingName: "구영준", note: "구영준 안수집사" });
    const sermon = item({ kind: "sermon", title: "설교", note: "그것을 보면 살리라", personId: "p1" });
    assert.equal(orderLine(hymn, [song], []), "찬송 455장 주님의 마음을 본받는 자");
    assert.equal(orderLine(dawn, [plain], []), "찬송 546장");
    assert.equal(orderLine(choir, [praise], []), "찬양 위드엘 찬양단");
    assert.equal(orderLine(prayer, [], []), "기도 구영준 안수집사");
    assert.equal(orderLine(sermon, [], [person]), "설교 그것을 보면 살리라 이종찬");
    const service = {
      id: "svc",
      title: "주일 1부 예배",
      date: "2026-10-11",
      time: "09:00",
      type: "sunday-1",
      place: "본당",
      preacherId: "p1",
      status: "planning",
      items: [hymn],
      announcements: [{ id: "a1", text: "새가족을 환영합니다." }],
      liveIndex: 0,
      startedAt: null,
      notes: "",
      checks: {},
      source: "bulletin",
    } as Service;
    const text = serviceText(service, [song], [person]);
    assert.match(text, /^인도 이종찬/);
    assert.match(text, /찬송 455장 주님의 마음을 본받는 자/);
    assert.match(text, /광고\n새가족을 환영합니다\./);
  });

  it("접속과 나간 시각만 문장으로 남긴다", () => {
    const opened = openVisit([], "Operator@Church.org", "2026-10-15T05:02:03.000Z");
    const noted = noteVisit(opened, "operator@church.org", "주보");
    const closed = noted.map((visit) => ({ ...visit, leftAt: "2026-10-15T05:12:09.000Z" }));
    const text = formatVisit(closed[0]);
    assert.match(text, /14시 2분 3초/);
    assert.match(text, /주보/);
    assert.match(text, /14시 12분 9초/);
    assert.equal(text.includes("순서를 고침"), false);
  });
});
