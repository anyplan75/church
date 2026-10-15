import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileMatchesQuery } from "./local-library.ts";
import { formatVisit, noteVisit, openVisit, settingsReady, setupComplete } from "./simple.ts";
import type { Settings } from "./types.ts";
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
