import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import {
  birthdaysForActor,
  canSeeEvent,
  eventsForActor,
  eventsForMemberships,
  googleCalendarCanWriteFromEnv,
  googleCalendarConfigFromEnv,
  googleCalendarReadPlan,
  googleCalendarWaitFromEnv,
  googleDeleteRequest,
  googleEventCoversDate,
  googleEventRequest,
  churchSeasonMarks,
  seasonIconKey,
  monthCells,
  monthDayMarks,
  westernAdventStart,
  westernEaster,
  parseLocalDateTime,
  withGoogleApiKey,
} from "@/calendar/rules";
import { buildServiceAccountAssertion, readGoogleCalendarMonth } from "@/server/calendar/google";

const COMMUNITY = "community-1";
const OTHER = "community-2";

const events = [
  { id: "public", communityId: COMMUNITY, title: "전체 모임", isLeaderOnly: false },
  { id: "leaders", communityId: COMMUNITY, title: "리더 회의", isLeaderOnly: true },
  { id: "other", communityId: OTHER, title: "다른 교회", isLeaderOnly: false },
];

describe("리더 일정 숨김", () => {
  it("구성원과 새가족은 리더 전용 일정과 다른 공동체 일정을 받지 않습니다", () => {
    for (const leaderView of [false]) {
      const visible = eventsForActor(events, COMMUNITY, true, leaderView);
      assert.deepEqual(
        visible.map((event) => event.id),
        ["public"],
      );
    }
    assert.equal(canSeeEvent({ isLeaderOnly: true, isFormalMember: true, canViewLeaderCalendar: false }), false);
    assert.equal(canSeeEvent({ isLeaderOnly: false, isFormalMember: true, canViewLeaderCalendar: false }), true);
  });

  it("사역자, 임원, 테우리는 리더 전용 일정을 봅니다", () => {
    const visible = eventsForActor(events, COMMUNITY, true, true);
    assert.deepEqual(
      visible.map((event) => event.id),
      ["public", "leaders"],
    );
  });

  it("손님은 일정을 받지 않습니다", () => {
    assert.deepEqual(eventsForActor(events, COMMUNITY, false, false), []);
    assert.equal(canSeeEvent({ isLeaderOnly: false, isFormalMember: false, canViewLeaderCalendar: false }), false);
  });

  it("속한 교회와 속한 모들 일정만 보여 줍니다", () => {
    const rows = [
      { id: "church", communityId: COMMUNITY, groupId: null, isLeaderOnly: false },
      { id: "my-group", communityId: COMMUNITY, groupId: "group-1", isLeaderOnly: false },
      { id: "other-group", communityId: COMMUNITY, groupId: "group-2", isLeaderOnly: false },
      { id: "other-church", communityId: OTHER, groupId: null, isLeaderOnly: false },
      { id: "leaders", communityId: COMMUNITY, groupId: null, isLeaderOnly: true },
    ];
    const visible = eventsForMemberships(rows, [
      { communityId: COMMUNITY, groupIds: ["group-1"], canViewLeaderCalendar: false },
    ]);
    assert.deepEqual(
      visible.map((event) => event.id),
      ["church", "my-group"],
    );
  });
});

describe("생일 자동 표시", () => {
  const people = [
    { memberId: "1", name: "박생일", birthDate: "2000-10-19" },
    { memberId: "2", name: "김윤년", birthDate: "2012-02-29" },
    { memberId: "3", name: "이삼월", birthDate: "1999-03-01" },
    { memberId: "4", name: "빈날", birthDate: null },
  ];

  it("그 달 생일을 일정 줄 없이 보여 주고 리더 전용이 아닙니다", () => {
    const marks = birthdaysForActor(people, 2026, 10, true);
    assert.deepEqual(marks, [{ memberId: "1", name: "박생일", date: "2026-10-19" }]);
    assert.equal(marks.some((mark) => "isLeaderOnly" in mark), false);
  });

  it("윤년 2월 29일은 평년에 만들지 않습니다", () => {
    assert.deepEqual(birthdaysForActor(people, 2026, 2, true), []);
    assert.deepEqual(birthdaysForActor(people, 2024, 2, true), [
      { memberId: "2", name: "김윤년", date: "2024-02-29" },
    ]);
  });

  it("구성원이 아니면 생일도 받지 않습니다", () => {
    assert.deepEqual(birthdaysForActor(people, 2026, 10, false), []);
  });
});

describe("구글 달력 설정", () => {
  const full = {
    GOOGLE_CALENDAR_CLIENT_ID: "client",
    GOOGLE_CALENDAR_CLIENT_SECRET: "secret",
    GOOGLE_CALENDAR_REFRESH_TOKEN: "refresh",
    GOOGLE_CALENDAR_ID: "calendar-id",
  };

  it("네 값이 모두 있을 때만 설정을 만듭니다", () => {
    assert.deepEqual(googleCalendarConfigFromEnv(full), {
      clientId: "client",
      clientSecret: "secret",
      refreshToken: "refresh",
      calendarId: "calendar-id",
    });
    assert.equal(googleCalendarConfigFromEnv({ ...full, GOOGLE_CALENDAR_REFRESH_TOKEN: "  " }), null);
    assert.equal(googleCalendarConfigFromEnv({}), null);
    assert.equal(googleCalendarConfigFromEnv({ GOOGLE_CALENDAR_API_KEY: "test-key" }), null);
    assert.equal(googleCalendarWaitFromEnv({ GOOGLE_CALENDAR_API_KEY: "test-key" }), "needs_calendar");
    assert.deepEqual(googleCalendarConfigFromEnv({ GOOGLE_CALENDAR_API_KEY: "test-key", GOOGLE_CALENDAR_ID: "calendar-id" }), {
      apiKey: "test-key",
      calendarId: "calendar-id",
    });
  });

  it("열쇠는 주소에만 붙이고 일정 본문에는 넣지 않습니다", () => {
    const created = googleEventRequest({
      calendarId: "cal id",
      googleEventId: null,
      title: "전체 모임",
      startAt: "2026-10-19T10:00:00.000Z",
      endAt: "2026-10-19T11:00:00.000Z",
    });
    const url = withGoogleApiKey(created.url, "test-key");
    assert.match(url, /[?&]key=test-key$/);
    assert.equal(JSON.stringify(created.body).includes("test-key"), false);
    assert.equal(withGoogleApiKey(created.url, "  "), created.url);
  });

  it("새 일정은 추가하고 있는 번호는 고칩니다. 본문에 열쇠를 넣지 않습니다", () => {
    const created = googleEventRequest({
      calendarId: "cal id",
      googleEventId: null,
      title: "전체 모임",
      startAt: "2026-10-19T10:00:00.000Z",
      endAt: "2026-10-19T11:00:00.000Z",
    });
    assert.equal(created.method, "POST");
    assert.match(created.url, /calendars\/cal%20id\/events$/);
    assert.deepEqual(Object.keys(created.body).sort(), ["end", "start", "summary"]);

    const updated = googleEventRequest({
      calendarId: "cal",
      googleEventId: "evt-1",
      title: "전체 모임",
      startAt: "2026-10-19T10:00:00.000Z",
      endAt: "2026-10-19T11:00:00.000Z",
    });
    assert.equal(updated.method, "PUT");
    assert.match(updated.url, /events\/evt-1$/);
    const removed = googleDeleteRequest("cal", "evt-1");
    assert.equal(removed.method, "DELETE");
    assert.match(removed.url, /calendars\/cal\/events\/evt-1$/);
  });

  it("날짜 입력은 년월일 시각 모양만 받습니다", () => {
    assert.ok(parseLocalDateTime("2026-10-19T10:30"));
    assert.equal(parseLocalDateTime("2026-10-19"), null);
  });

  it("열쇠만 있으면 보내기 설정이 되지 않습니다", () => {
    assert.equal(googleCalendarCanWriteFromEnv({ GOOGLE_CALENDAR_API_KEY: "test-key", GOOGLE_CALENDAR_ID: "calendar-id" }), false);
  });
});

describe("월 달력", () => {
  it("빈 달의 날짜 칸을 만들고 없는 일정은 넣지 않습니다", () => {
    const cells = monthCells(2026, 10);
    assert.equal(cells.length, 35);
    assert.equal(cells[0].date, null);
    assert.deepEqual(cells[4], { date: "2026-10-01", day: 1 });
    assert.deepEqual(cells[33], { date: "2026-10-30", day: 30 });
    const marks = monthDayMarks(2026, 10, [], []);
    assert.equal(marks.filter((cell) => cell.date).every((cell) => cell.marks.length === 0), true);
  });

  it("저장된 일정과 구글 일정만 그 날짜에 놓습니다", () => {
    const events = [
      { id: "modl-1", title: "전체 모임", startAt: "2026-10-19T10:00", endAt: "2026-10-19T11:00", isLeaderOnly: false },
    ];
    const googleEvents = [
      { id: "g-1", title: "새벽", startAt: "2026-10-19", endAt: "2026-10-20", allDay: true },
      { id: "g-2", title: "밤 모임", startAt: "2026-10-19T23:30:00+09:00", endAt: "2026-10-20T01:00:00+09:00", allDay: false },
    ];
    const days = monthDayMarks(2026, 10, events, [], googleEvents);
    const on18 = days.find((cell) => cell.date === "2026-10-18");
    const on19 = days.find((cell) => cell.date === "2026-10-19");
    const on20 = days.find((cell) => cell.date === "2026-10-20");
    assert.deepEqual(on18?.marks ?? [], []);
    assert.deepEqual(on19?.marks.map((mark) => mark.title), ["전체 모임", "새벽", "밤 모임"]);
    assert.deepEqual(on20?.marks.map((mark) => mark.title), ["밤 모임"]);
    assert.equal(googleEventCoversDate(googleEvents[0], "2026-10-20"), false);
    assert.equal(on19?.marks.every((mark) => mark.kind !== "season"), true);
  });
});

describe("교회 절기", () => {
  it("서력 부활절과 그에 매인 하루 절기만 계산합니다", () => {
    assert.deepEqual(westernEaster(2024), { year: 2024, month: 3, day: 31 });
    assert.deepEqual(westernEaster(2025), { year: 2025, month: 4, day: 20 });
    assert.deepEqual(westernEaster(2026), { year: 2026, month: 4, day: 5 });
    assert.deepEqual(westernEaster(2027), { year: 2027, month: 3, day: 28 });
    assert.equal(new Date(Date.UTC(2026, 3, 5)).getUTCDay(), 0);
    assert.deepEqual(westernAdventStart(2026), { year: 2026, month: 11, day: 29 });
    assert.deepEqual(westernAdventStart(2023), { year: 2023, month: 12, day: 3 });
    assert.deepEqual(westernAdventStart(2022), { year: 2022, month: 11, day: 27 });

    const titles = (year: number, month: number, day: number) =>
      churchSeasonMarks(year, month)
        .filter((mark) => mark.date === `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
        .map((mark) => mark.title);

    assert.deepEqual(titles(2026, 1, 6), ["주현절"]);
    assert.deepEqual(titles(2026, 2, 18), ["재의 수요일", "사순절 시작"]);
    assert.deepEqual(titles(2026, 2, 19), ["사순절"]);
    assert.deepEqual(titles(2026, 3, 29), ["사순절", "종려주일"]);
    assert.deepEqual(titles(2026, 4, 3), ["사순절", "성금요일"]);
    assert.deepEqual(titles(2026, 4, 4), ["사순절"]);
    assert.deepEqual(titles(2026, 4, 5), ["부활절"]);
    assert.deepEqual(titles(2026, 4, 6), []);
    assert.deepEqual(titles(2026, 5, 14), ["승천일"]);
    assert.deepEqual(titles(2026, 5, 24), ["성령강림절"]);
    assert.deepEqual(titles(2026, 10, 21), []);
    assert.deepEqual(titles(2026, 11, 29), ["대림절 시작"]);
    assert.deepEqual(titles(2026, 11, 30), ["대림절"]);
    assert.deepEqual(titles(2026, 12, 24), ["대림절"]);
    assert.deepEqual(titles(2026, 12, 25), ["성탄절"]);
    assert.deepEqual(titles(2026, 12, 26), []);
    assert.equal(seasonIconKey("대림절"), "advent");
    assert.equal(seasonIconKey("성탄절"), "christmas");
    assert.equal(seasonIconKey("사순절"), "lent");
    assert.equal(seasonIconKey("성금요일"), "cross");
    assert.equal(seasonIconKey("부활절"), "easter");
    assert.equal(seasonIconKey("성령강림절"), "pentecost");
    assert.equal(seasonIconKey("없는 절기"), null);
  });

  it("절기는 칸에만 보이고 저장된 일정을 지우지 않습니다", () => {
    const allowed = new Set([
      "대림절 시작",
      "대림절",
      "성탄절",
      "주현절",
      "재의 수요일",
      "사순절 시작",
      "사순절",
      "종려주일",
      "성금요일",
      "부활절",
      "승천일",
      "성령강림절",
    ]);
    const seasons = [1, 2, 3, 4, 5, 6, 10, 11, 12].flatMap((month) => churchSeasonMarks(2026, month));
    assert.equal(seasons.every((mark) => allowed.has(mark.title)), true);
    assert.equal(churchSeasonMarks(2026, 10).length, 0);
    const days = monthDayMarks(
      2026,
      12,
      [{ id: "modl-1", title: "전체 모임", startAt: "2026-12-25T10:00", endAt: "2026-12-25T11:00", isLeaderOnly: false }],
      [],
      [],
    );
    const christmas = days.find((cell) => cell.date === "2026-12-25");
    assert.deepEqual(christmas?.marks.map((mark) => mark.title), ["전체 모임", "성탄절"]);
    assert.equal(christmas?.marks[1]?.kind, "season");
    assert.equal(christmas?.marks[1]?.href, null);
  });
});

describe("구글 달력 읽기", () => {
  const keys = ["GOOGLE_CALENDAR_ID", "GOOGLE_CALENDAR_API_KEY", "GOOGLE_SHEETS_SERVICE_ACCOUNT"] as const;

  async function withEnv(env: Record<(typeof keys)[number], string | undefined>, run: () => Promise<void>) {
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    try {
      await run();
    } finally {
      for (const key of keys) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    }
  }

  it("달력 번호가 없으면 읽지 않습니다", () => {
    assert.deepEqual(
      googleCalendarReadPlan({ calendarId: "  ", apiKey: "test-key", hasServiceAccount: true, timeMin: "a", timeMax: "b" }),
      { mode: "skip" },
    );
    assert.equal(googleCalendarReadPlan({ calendarId: "calendar-id", apiKey: "", hasServiceAccount: false, timeMin: "a", timeMax: "b" }).mode, "skip");
  });

  it("공개 달력은 열쇠 주소로, 공유 달력은 열쇠 없는 주소로 읽습니다", () => {
    const range = { timeMin: "2026-10-01T00:00:00+09:00", timeMax: "2026-11-01T00:00:00+09:00" };
    const pub = googleCalendarReadPlan({ calendarId: "calendar-id", apiKey: "test-key", hasServiceAccount: false, ...range });
    assert.equal(pub.mode, "public");
    if (pub.mode === "public") {
      assert.match(pub.url, /calendars\/calendar-id\/events/);
      assert.match(pub.url, /key=test-key/);
      assert.equal(pub.url.includes("events?"), true);
    }
    const shared = googleCalendarReadPlan({ calendarId: "calendar-id", apiKey: "", hasServiceAccount: true, ...range });
    assert.equal(shared.mode, "shared");
    if (shared.mode === "shared") assert.equal(shared.url.includes("key="), false);
  });

  it("달력 번호가 없으면 구글을 부르지 않고 일정을 만들지 않습니다", async () => {
    await withEnv({ GOOGLE_CALENDAR_ID: undefined, GOOGLE_CALENDAR_API_KEY: "test-key", GOOGLE_SHEETS_SERVICE_ACCOUNT: undefined }, async () => {
      let called = false;
      const result = await readGoogleCalendarMonth("2026-10-01T00:00:00+09:00", "2026-11-01T00:00:00+09:00", async () => {
        called = true;
        return new Response("{}", { status: 200 });
      });
      assert.equal(called, false);
      assert.deepEqual(result, { status: "skipped", items: [] });
    });
  });

  it("공개로 읽히면 그 일정만 가져오고 새로 만들지 않습니다", async () => {
    await withEnv({ GOOGLE_CALENDAR_ID: "calendar-id", GOOGLE_CALENDAR_API_KEY: "test-key", GOOGLE_SHEETS_SERVICE_ACCOUNT: undefined }, async () => {
      const methods: string[] = [];
      const result = await readGoogleCalendarMonth("2026-10-01T00:00:00+09:00", "2026-11-01T00:00:00+09:00", async (url, init) => {
        methods.push(init?.method ?? "GET");
        assert.match(url, /key=test-key/);
        return Response.json({
          items: [
            { id: "real-1", summary: "새벽 기도", status: "confirmed", start: { date: "2026-10-03" }, end: { date: "2026-10-04" } },
            { id: "gone", summary: "지운 일정", status: "cancelled", start: { date: "2026-10-04" }, end: { date: "2026-10-05" } },
          ],
        });
      });
      assert.deepEqual(methods, ["GET"]);
      assert.equal(result.status, "ok");
      assert.deepEqual(result.items.map((item) => item.title), ["새벽 기도"]);
    });
  });

  it("403이면 서비스 계정으로 읽고, 그것도 막히면 일정을 비웁니다", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const account = JSON.stringify({ client_email: "reader@example.com", private_key: pem });
    await withEnv({ GOOGLE_CALENDAR_ID: "calendar-id", GOOGLE_CALENDAR_API_KEY: "test-key", GOOGLE_SHEETS_SERVICE_ACCOUNT: account }, async () => {
      const seen: string[] = [];
      const blocked = await readGoogleCalendarMonth("2026-10-01T00:00:00+09:00", "2026-11-01T00:00:00+09:00", async (url, init) => {
        seen.push(`${init?.method ?? "GET"} ${url}`);
        if (url.includes("oauth2.googleapis.com")) return Response.json({ access_token: "access-token-fixture" });
        if (url.includes("key=")) return new Response("", { status: 403 });
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("authorization"), "Bearer access-token-fixture");
        return new Response("", { status: 403 });
      });
      assert.equal(blocked.status, "needs_share");
      assert.deepEqual(blocked.items, []);
      assert.equal(seen.some((line) => line.startsWith("POST") && line.includes("/events")), false);

      const opened = await readGoogleCalendarMonth("2026-10-01T00:00:00+09:00", "2026-11-01T00:00:00+09:00", async (url, init) => {
        if (url.includes("oauth2.googleapis.com")) return Response.json({ access_token: "access-token-fixture" });
        if (url.includes("key=")) return new Response("", { status: 404 });
        assert.equal(init?.method ?? "GET", "GET");
        return Response.json({
          items: [{ id: "real-2", summary: "청년 모임", start: { dateTime: "2026-10-11T14:00:00+09:00" }, end: { dateTime: "2026-10-11T16:00:00+09:00" } }],
        });
      });
      assert.equal(opened.status, "ok");
      assert.deepEqual(opened.items.map((item) => item.title), ["청년 모임"]);
    });
    const assertion = buildServiceAccountAssertion({ clientEmail: "reader@example.com", privateKey: pem }, 1_700_000_000_000);
    assert.equal(assertion.includes(pem), false);
    assert.equal(assertion.includes("PRIVATE KEY"), false);
    const payload = JSON.parse(Buffer.from(assertion.split(".")[1] ?? "", "base64url").toString());
    assert.equal(payload.scope, "https://www.googleapis.com/auth/calendar.readonly");
  });
});
