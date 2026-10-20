import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  birthdaysForActor,
  canSeeEvent,
  eventsForActor,
  googleCalendarConfigFromEnv,
  googleCalendarWaitFromEnv,
  googleDeleteRequest,
  googleEventRequest,
  parseLocalDateTime,
  withGoogleApiKey,
} from "@/calendar/rules";

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
});
