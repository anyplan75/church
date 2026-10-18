import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMemberBulletin,
  memberLyricsFor,
  memberServiceOptions,
  pickMemberService,
  pickReasonLabel,
} from "./member-bulletin.ts";
import type { Person, Service, Song } from "./types.ts";

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
        items: [{ id: "i1", kind: "hymn", title: "찬송", note: "", scripture: "", scriptureText: "", scriptureLicensed: false, screenCue: "", personId: null, pendingName: "", songId: "s1" }],
      }),
      service({ id: "d", title: "다음주", date: "2026-10-25", time: "11:00", status: "planning" }),
    ];
    assert.equal(pickMemberService(list, "", "2026-10-18")?.service.id, "c");
    assert.equal(pickMemberService(list.filter((s) => s.id !== "c"), "", "2026-10-18")?.reason, "today");
    assert.equal(pickMemberService(list, "d", "2026-10-18")?.reason, "selected");
    assert.equal(pickReasonLabel("live"), "지금 진행 중");
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
        {
          id: "i1",
          kind: "hymn",
          title: "찬송",
          note: "",
          scripture: "",
          scriptureText: "",
          scriptureLicensed: false,
          screenCue: "",
          personId: null,
          pendingName: "",
          songId: "s1",
        },
        {
          id: "i2",
          kind: "sermon",
          title: "설교",
          note: "은혜의 말씀",
          scripture: "요한복음 3:16",
          scriptureText: "",
          scriptureLicensed: false,
          screenCue: "",
          personId: "p1",
          pendingName: "",
          songId: null,
        },
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
        {
          id: "i1",
          kind: "hymn",
          title: "찬송",
          note: "",
          scripture: "",
          scriptureText: "",
          scriptureLicensed: false,
          screenCue: "",
          personId: null,
          pendingName: "",
          songId: "s1",
        },
        {
          id: "i2",
          kind: "hymn",
          title: "찬송",
          note: "",
          scripture: "",
          scriptureText: "",
          scriptureLicensed: false,
          screenCue: "",
          personId: null,
          pendingName: "",
          songId: "s2",
        },
      ],
    });
    const lyrics = memberLyricsFor(svc, people, songs);
    assert.equal(lyrics[0]?.lines[0], "만복의 근원 하나님");
    assert.equal(lyrics[1]?.lines.length, 0);
    assert.match(lyrics[1]?.footer || "", /가사 없이/);
    assert.equal(memberServiceOptions([svc], "2026-10-18")[0]?.id, "svc");
  });
});
