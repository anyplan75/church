import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMemberBulletin,
  memberLiveCaption,
  memberLyricsFor,
  memberServiceOptions,
  pickMemberService,
  pickReasonLabel,
  serviceOptionLabel,
} from "./member-bulletin.ts";
import type { Person, Service, Song, WorshipItem } from "./types.ts";

function item(partial: Partial<WorshipItem> & Pick<WorshipItem, "id" | "kind" | "title">): WorshipItem {
  return {
    note: "",
    scripture: "",
    scriptureText: "",
    scriptureLicensed: false,
    screenCue: "",
    personId: null,
    pendingName: "",
    songId: null,
    ...partial,
  };
}

function service(partial: Partial<Service> & Pick<Service, "id" | "title" | "date" | "time">): Service {
  return {
    type: "sunday-2",
    place: "본당",
    preacherId: null,
    status: "ready",
    items: [],
    announcements: [],
    liveIndex: 0,
    startedAt: null,
    notes: "",
    checks: {},
    source: "bulletin",
    ...partial,
  };
}

const people: Person[] = [
  {
    id: "p1",
    name: "김은혜",
    phone: "",
    roles: ["목사"],
    active: true,
    membership: "member",
    attendanceConsent: true,
    category: "minister",
    office: "목사",
    address: "",
    email: "",
    memo: "",
    photo: "",
  },
];

const songs: Song[] = [
  { id: "s1", title: "만복의 근원 하나님", hymnNumber: "1", key: "G", license: "permitted", permittedLine: "만복의 근원 하나님" },
  { id: "s2", title: "주 예수 이름 높이어", hymnNumber: "8", key: "", license: "title-only", permittedLine: "" },
];

describe("member-bulletin", () => {
  it("picks live, then today, then upcoming service", () => {
    const list = [
      service({ id: "a", title: "수요", date: "2026-10-15", time: "19:00", status: "done" }),
      service({ id: "b", title: "주일", date: "2026-10-18", time: "11:00", status: "ready" }),
      service({
        id: "c",
        title: "저녁",
        date: "2026-10-18",
        time: "19:00",
        status: "live",
        items: [item({ id: "i1", kind: "hymn", title: "찬송", songId: "s1" })],
      }),
      service({ id: "d", title: "다음주", date: "2026-10-25", time: "11:00", status: "planning" }),
    ];
    assert.equal(pickMemberService(list, "", "2026-10-18")?.service.id, "c");
    assert.equal(pickMemberService(list.filter((s) => s.id !== "c"), "", "2026-10-18")?.reason, "today");
    assert.equal(pickMemberService(list, "d", "2026-10-18")?.reason, "selected");
    assert.equal(pickReasonLabel("live"), "지금 진행 중");
  });

  it("lists same-day youth and young-adult bulletins together", () => {
    const list = [
      service({ id: "youth", title: "청소년부", date: "2026-10-18", time: "09:30", status: "ready" }),
      service({ id: "young", title: "청년부", date: "2026-10-18", time: "14:00", status: "ready" }),
      service({ id: "main", title: "주일 2부", date: "2026-10-18", time: "11:00", status: "live" }),
    ];
    const options = memberServiceOptions(list, "2026-10-18");
    assert.equal(options.length, 3);
    assert.ok(options.some((row) => row.id === "youth"));
    assert.ok(options.some((row) => row.id === "young"));
    assert.match(serviceOptionLabel(list[2]!), /진행 중/);
  });

  it("builds bulletin order and notices from service data", () => {
    const svc = service({
      id: "svc",
      title: "주일예배",
      date: "2026-10-18",
      time: "11:00",
      preacherId: "p1",
      announcements: [
        { id: "n1", text: "새가족 안내" },
        { id: "n2", text: "  " },
      ],
      items: [
        item({ id: "i1", kind: "hymn", title: "찬송", songId: "s1" }),
        item({
          id: "i2",
          kind: "sermon",
          title: "설교",
          note: "은혜의 말씀",
          scripture: "요한복음 3:16",
          personId: "p1",
        }),
      ],
    });
    const view = buildMemberBulletin(svc, people, songs, "은혜교회");
    assert.equal(view.churchName, "은혜교회");
    assert.equal(view.preacher, "김은혜");
    assert.equal(view.sermonTitle, "은혜의 말씀");
    assert.equal(view.notices.length, 1);
    assert.equal(view.order.length, 2);
    assert.match(view.order[0]?.aside || "", /1장/);
  });

  it("shows permitted lyric line and title-only songs without secret lyrics", () => {
    const svc = service({
      id: "svc",
      title: "주일",
      date: "2026-10-18",
      time: "11:00",
      items: [
        item({ id: "i1", kind: "hymn", title: "찬송", songId: "s1" }),
        item({ id: "i2", kind: "hymn", title: "찬송", songId: "s2" }),
      ],
    });
    const lyrics = memberLyricsFor(svc, people, songs);
    assert.equal(lyrics[0]?.lines[0], "만복의 근원 하나님");
    assert.equal(lyrics[1]?.lines.length, 0);
    assert.match(lyrics[1]?.footer || "", /가사 없이/);
    assert.equal(memberServiceOptions([svc], "2026-10-18")[0]?.id, "svc");
  });

  it("builds live praise and word captions from liveIndex and outputLines", () => {
    const praise = service({
      id: "live-praise",
      title: "청년부",
      date: "2026-10-18",
      time: "14:00",
      status: "live",
      liveIndex: 0,
      outputLines: ["주 예수 이름 높이어"],
      items: [
        item({ id: "i1", kind: "praise", title: "찬양", songId: "s1" }),
        item({
          id: "i2",
          kind: "sermon",
          title: "설교",
          note: "은혜의 말씀",
          scripture: "요한복음 3:16",
          scriptureText: "하나님이 세상을 이처럼 사랑하사",
          scriptureLicensed: true,
          personId: "p1",
        }),
      ],
    });
    const praiseCaption = memberLiveCaption(praise, people, songs);
    assert.equal(praiseCaption.mode, "praise");
    assert.equal(praiseCaption.source, "output");
    assert.equal(praiseCaption.lines[0], "주 예수 이름 높이어");

    const word = {
      ...praise,
      liveIndex: 1,
      outputLines: [],
    };
    const wordCaption = memberLiveCaption(word, people, songs);
    assert.equal(wordCaption.mode, "word");
    assert.ok(wordCaption.lines.some((line) => /요한복음|하나님이/.test(line)));
  });
});
