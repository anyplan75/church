/**
 * 일정 공개 범위와 생일, 구글 달력 요청 모양입니다.
 * 열쇠 값은 여기서 만들지 않고, 비어 있으면 설정을 없는 것으로 봅니다.
 */

export type CalendarCategory = "RETREAT" | "EVENT" | "BIRTHDAY" | "HOLIDAY" | "ETC";

export type CalendarEventView = {
  communityId: string;
  isLeaderOnly: boolean;
};

export function canSeeEvent(input: {
  isLeaderOnly: boolean;
  isFormalMember: boolean;
  canViewLeaderCalendar: boolean;
}): boolean {
  if (!input.isFormalMember) return false;
  if (input.isLeaderOnly) return input.canViewLeaderCalendar;
  return true;
}

export function eventsForActor<T extends CalendarEventView>(
  events: readonly T[],
  communityId: string,
  isFormalMember: boolean,
  canViewLeaderCalendar: boolean,
): T[] {
  return events.filter(
    (event) =>
      event.communityId === communityId &&
      canSeeEvent({
        isLeaderOnly: event.isLeaderOnly,
        isFormalMember,
        canViewLeaderCalendar,
      }),
  );
}

export type CalendarMembership = {
  communityId: string;
  groupIds: readonly string[];
  canViewLeaderCalendar: boolean;
};

/** 속한 교회의 교회 일정과, 속한 모들의 일정만 남깁니다. */
export function eventsForMemberships<T extends CalendarEventView & { groupId: string | null }>(
  events: readonly T[],
  memberships: readonly CalendarMembership[],
): T[] {
  const byChurch = new Map(memberships.map((item) => [item.communityId, item]));
  return events.filter((event) => {
    const membership = byChurch.get(event.communityId);
    if (!membership) return false;
    if (event.groupId && !membership.groupIds.includes(event.groupId)) return false;
    return canSeeEvent({
      isLeaderOnly: event.isLeaderOnly,
      isFormalMember: true,
      canViewLeaderCalendar: membership.canViewLeaderCalendar,
    });
  });
}

export type BirthdaySource = {
  memberId: string;
  name: string;
  birthDate: string | null;
};

export type BirthdayMark = {
  memberId: string;
  name: string;
  date: string;
};

function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

/** 명부 생일로 그 달의 날짜를 만듭니다. 일정 줄을 새로 만들지 않습니다. */
export function birthdayMarks(people: readonly BirthdaySource[], year: number, month: number): BirthdayMark[] {
  const monthText = String(month).padStart(2, "0");
  const marks: BirthdayMark[] = [];
  for (const person of people) {
    if (!person.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(person.birthDate)) continue;
    const [, birthMonth, birthDay] = person.birthDate.split("-");
    if (birthMonth !== monthText || !birthDay) continue;
    if (birthMonth === "02" && birthDay === "29" && !isLeapYear(year)) continue;
    marks.push({
      memberId: person.memberId,
      name: person.name,
      date: `${year}-${birthMonth}-${birthDay}`,
    });
  }
  return marks.sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name, "ko"));
}

export function birthdaysForActor(
  people: readonly BirthdaySource[],
  year: number,
  month: number,
  isFormalMember: boolean,
): BirthdayMark[] {
  if (!isFormalMember) return [];
  return birthdayMarks(people, year, month);
}

export type GoogleCalendarConfig = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  calendarId: string;
  apiKey?: string;
};

export type GoogleCalendarWait = "ready" | "needs_calendar" | "missing";

export function googleCalendarConfigFromEnv(env: {
  GOOGLE_CALENDAR_CLIENT_ID?: string;
  GOOGLE_CALENDAR_CLIENT_SECRET?: string;
  GOOGLE_CALENDAR_REFRESH_TOKEN?: string;
  GOOGLE_CALENDAR_ID?: string;
  GOOGLE_CALENDAR_API_KEY?: string;
}): GoogleCalendarConfig | null {
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ?? "";
  const refreshToken = env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim() ?? "";
  const calendarId = env.GOOGLE_CALENDAR_ID?.trim() ?? "";
  const apiKey = env.GOOGLE_CALENDAR_API_KEY?.trim() ?? "";
  if (clientId && clientSecret && refreshToken && calendarId) {
    return apiKey
      ? { clientId, clientSecret, refreshToken, calendarId, apiKey }
      : { clientId, clientSecret, refreshToken, calendarId };
  }
  if (apiKey && calendarId) return { apiKey, calendarId };
  return null;
}

/** 달력 번호가 없으면 열쇠만 있어도 구글에 보내지 않습니다. */
export function googleCalendarWaitFromEnv(env: {
  GOOGLE_CALENDAR_CLIENT_ID?: string;
  GOOGLE_CALENDAR_CLIENT_SECRET?: string;
  GOOGLE_CALENDAR_REFRESH_TOKEN?: string;
  GOOGLE_CALENDAR_ID?: string;
  GOOGLE_CALENDAR_API_KEY?: string;
}): GoogleCalendarWait {
  if (googleCalendarConfigFromEnv(env)) return "ready";
  const apiKey = env.GOOGLE_CALENDAR_API_KEY?.trim() ?? "";
  const calendarId = env.GOOGLE_CALENDAR_ID?.trim() ?? "";
  if (apiKey && !calendarId) return "needs_calendar";
  return "missing";
}

/** 주소에 열쇠를 붙입니다. 일정 본문에는 넣지 않습니다. */
export function withGoogleApiKey(url: string, apiKey: string | undefined): string {
  const trimmed = apiKey?.trim() ?? "";
  if (!trimmed) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("key", trimmed);
  return parsed.toString();
}

export type GoogleEventBody = {
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
};

export function googleEventRequest(input: {
  calendarId: string;
  googleEventId: string | null;
  title: string;
  startAt: string;
  endAt: string;
}): { method: "POST" | "PUT"; url: string; body: GoogleEventBody } {
  const calendar = encodeURIComponent(input.calendarId);
  const body = {
    summary: input.title,
    start: { dateTime: input.startAt },
    end: { dateTime: input.endAt },
  };
  if (input.googleEventId) {
    return {
      method: "PUT",
      url: `https://www.googleapis.com/calendar/v3/calendars/${calendar}/events/${encodeURIComponent(input.googleEventId)}`,
      body,
    };
  }
  return {
    method: "POST",
    url: `https://www.googleapis.com/calendar/v3/calendars/${calendar}/events`,
    body,
  };
}

export function googleDeleteRequest(calendarId: string, googleEventId: string): { method: "DELETE"; url: string } {
  return {
    method: "DELETE",
    url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
  };
}

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type MonthCell = {
  date: string | null;
  day: number | null;
};

/** 그 달의 날짜 칸입니다. 일정은 넣지 않습니다. */
export function monthCells(year: number, month: number): MonthCell[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const lastDay = new Date(year, month, 0).getDate();
  const cells: MonthCell[] = [];
  for (let index = 0; index < firstWeekday; index += 1) cells.push({ date: null, day: null });
  const monthText = String(month).padStart(2, "0");
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push({
      date: `${year}-${monthText}-${String(day).padStart(2, "0")}`,
      day,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
  return cells;
}

export function seoulToday(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

/** 한국 시간 기준으로 그 달의 처음과 끝입니다. */
export function seoulMonthRange(year: number, month: number): { timeMin: string; timeMax: string } {
  const pad = (value: number) => String(value).padStart(2, "0");
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return {
    timeMin: `${year}-${pad(month)}-01T00:00:00+09:00`,
    timeMax: `${nextYear}-${pad(nextMonth)}-01T00:00:00+09:00`,
  };
}

export type CalendarDayEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  isLeaderOnly: boolean;
  placeName?: string | null;
  placeKind?: "church" | "gathering" | null;
  placeId?: string | null;
};

export type GoogleEventView = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
};

export type DayMark = {
  key: string;
  title: string;
  /** 주간 칸에만 보이는 짧은 줄입니다. 월별 칸에는 제목만 둡니다. */
  summary: string | null;
  kind: "event" | "birthday" | "google" | "season";
  href: string | null;
  leaderOnly: boolean;
  placeName: string | null;
  placeKind: "church" | "gathering" | null;
  placeColor: string | null;
};

const CHURCH_SWATCHES = ["#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#1d4f91", "#1a56c4", "#2451b8", "#0f3d91", "#163e86", "#1c4ed8", "#1347b8", "#1e4b9c"] as const;
const GATHERING_SWATCHES = ["#4c1d95", "#5b21b6", "#6d28d9", "#7c3aed", "#6b21a8", "#581c87", "#7e22ce", "#5521a8", "#6d28b8", "#4a1d96", "#6928c4", "#5b1d9a"] as const;

function swatchIndex(id: string, size: number): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

/** 같은 교회·모들은 항상 같은 색입니다. 교회는 파란 계열, 모들은 보라 계열입니다. */
export function schedulePlaceColor(kind: "church" | "gathering", id: string): string {
  const palette = kind === "church" ? CHURCH_SWATCHES : GATHERING_SWATCHES;
  return palette[swatchIndex(id, palette.length)] ?? palette[0];
}

const NO_PLACE = { placeName: null, placeKind: null, placeColor: null } as const;

function placeOf(event: CalendarDayEvent): { placeName: string | null; placeKind: "church" | "gathering" | null; placeColor: string | null } {
  const placeName = event.placeName?.trim() || null;
  const placeKind = event.placeKind === "church" || event.placeKind === "gathering" ? event.placeKind : null;
  const placeId = event.placeId?.trim() || null;
  if (!placeName || !placeKind || !placeId) return NO_PLACE;
  return { placeName, placeKind, placeColor: schedulePlaceColor(placeKind, placeId) };
}

/** 일요일로 시작하는 그 주의 일곱 날짜입니다. 없는 날짜는 만들지 않습니다. */
export function weekDateKeys(anchor: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return [];
  const [year, month, day] = anchor.split("-").map(Number);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return [];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return [];
  const start = addCivilDays({ year, month, day }, -check.getUTCDay());
  return Array.from({ length: 7 }, (_, index) => civilKey(addCivilDays(start, index)));
}

export function shiftDateKey(date: string, days: number): string {
  const keys = weekDateKeys(date);
  if (keys.length !== 7) return date;
  const [year, month, day] = date.split("-").map(Number);
  return civilKey(addCivilDays({ year, month, day }, days));
}

export type MonthDayCell = {
  date: string | null;
  day: number | null;
  marks: DayMark[];
};

function seoulClock(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(parsed));
}

function nextDateKey(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + 1));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function dayRange(date: string): { start: number; end: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = Date.parse(`${date}T00:00:00+09:00`);
  const end = Date.parse(`${nextDateKey(date)}T00:00:00+09:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return { start, end };
}

/** 구글이 돌려준 일정이 그 날짜와 겹치는지만 봅니다. */
export function googleEventCoversDate(event: Pick<GoogleEventView, "startAt" | "endAt" | "allDay">, date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (event.allDay) {
    if (date < event.startAt) return false;
    if (!event.endAt || event.endAt <= event.startAt) return date === event.startAt;
    return date < event.endAt;
  }
  const range = dayRange(date);
  const start = Date.parse(event.startAt);
  const end = Date.parse(event.endAt);
  if (!range || Number.isNaN(start) || Number.isNaN(end)) return false;
  return start < range.end && end > range.start;
}

function eventCoversLocalDate(event: Pick<CalendarDayEvent, "startAt" | "endAt">, date: string): boolean {
  const range = dayRange(date);
  const start = parseLocalDateTime(event.startAt);
  const end = parseLocalDateTime(event.endAt);
  if (!range || !start || !end) return false;
  const startUtc = Date.parse(`${event.startAt}:00+09:00`);
  const endUtc = Date.parse(`${event.endAt}:00+09:00`);
  if (Number.isNaN(startUtc) || Number.isNaN(endUtc)) return false;
  return startUtc < range.end && endUtc > range.start;
}

type CivilDate = { year: number; month: number; day: number };

function civilKey(date: CivilDate): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function addCivilDays(date: CivilDate, days: number): CivilDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function eachCivilDate(start: CivilDate, end: CivilDate): CivilDate[] {
  const dates: CivilDate[] = [];
  let cursor = start;
  while (civilKey(cursor) <= civilKey(end)) {
    dates.push(cursor);
    cursor = addCivilDays(cursor, 1);
    if (dates.length > 80) break;
  }
  return dates;
}

/** 서력 교회력의 부활절입니다. 3월 21일 이후 보름 다음 일요일을 교회의 계산으로 고릅니다. */
export function westernEaster(year: number): CivilDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

/** 성탄 직전 일요일에서 세 주 앞인 대림절 시작입니다. */
export function westernAdventStart(year: number): CivilDate {
  const christmasWeekday = new Date(Date.UTC(year, 11, 25)).getUTCDay();
  const daysBeforeChristmas = christmasWeekday === 0 ? 7 : christmasWeekday;
  return addCivilDays({ year, month: 12, day: 25 }, -(daysBeforeChristmas + 21));
}

/**
 * 그 해의 교회 절기만 날짜에 붙입니다.
 * 대림절과 사순절은 기간이고, 나머지 여덟은 하루입니다. 모임 일정은 만들지 않습니다.
 */
export function churchSeasonMarks(year: number, month: number): Array<{ date: string; title: string }> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];
  const titles = new Map<string, string[]>();
  const add = (date: CivilDate, title: string) => {
    if (date.year !== year || date.month !== month) return;
    const key = civilKey(date);
    const list = titles.get(key) ?? [];
    list.push(title);
    titles.set(key, list);
  };

  const adventStart = westernAdventStart(year);
  for (const date of eachCivilDate(adventStart, { year, month: 12, day: 24 })) {
    add(date, civilKey(date) === civilKey(adventStart) ? "대림절 시작" : "대림절");
  }
  add({ year, month: 12, day: 25 }, "성탄절");
  add({ year, month: 1, day: 6 }, "주현절");

  const easter = westernEaster(year);
  const ashWednesday = addCivilDays(easter, -46);
  for (const date of eachCivilDate(ashWednesday, addCivilDays(easter, -1))) {
    if (civilKey(date) === civilKey(ashWednesday)) {
      add(date, "재의 수요일");
      add(date, "사순절 시작");
    } else {
      add(date, "사순절");
    }
  }
  add(addCivilDays(easter, -7), "종려주일");
  add(addCivilDays(easter, -2), "성금요일");
  add(easter, "부활절");
  add(addCivilDays(easter, 39), "승천일");
  add(addCivilDays(easter, 49), "성령강림절");

  return [...titles.entries()].flatMap(([date, names]) => names.map((title) => ({ date, title })));
}

/** 이미 계산된 절기 제목에만 아이콘 이름을 붙입니다. 없는 절기는 만들지 않습니다. */
const SEASON_ICON_KEYS: Record<string, string> = {
  "대림절 시작": "advent",
  대림절: "advent",
  성탄절: "christmas",
  주현절: "epiphany",
  "재의 수요일": "ash",
  "사순절 시작": "lent",
  사순절: "lent",
  종려주일: "palm",
  성금요일: "cross",
  부활절: "easter",
  승천일: "ascension",
  성령강림절: "pentecost",
};

export function seasonIconKey(title: string): string | null {
  return SEASON_ICON_KEYS[title] ?? null;
}

/** 이미 있는 절기 제목에만 짧은 안내를 붙입니다. 새 절기 문장은 만들지 않습니다. */
const SEASON_GUIDES: Record<string, string> = {
  "대림절 시작": "대림절은 성탄을 기다리며 준비하는 네 주간입니다. 이 날은 그 기간이 시작되는 날입니다.",
  대림절: "대림절은 성탄을 기다리며 준비하는 네 주간입니다. 교회는 이 기간에 오실 주님을 기억합니다.",
  성탄절: "성탄절은 예수님이 사람으로 태어나신 날입니다.",
  주현절: "주현절은 아기 예수님이 동방 박사에게 나타나신 날입니다.",
  "재의 수요일": "재의 수요일은 사순절이 시작되는 날입니다. 회개하며 재를 얹는 전통이 있습니다.",
  "사순절 시작": "사순절은 부활절을 앞두고 사십 일 동안 금식하고 회개하는 기간입니다. 이 날은 그 기간이 시작되는 날입니다.",
  사순절: "사순절은 부활절을 앞두고 사십 일 동안 금식하고 회개하는 기간입니다.",
  종려주일: "종려주일은 예수님이 예루살렘에 들어가실 때 무리가 종려나무 가지를 흔든 날입니다.",
  성금요일: "성금요일은 예수님이 십자가에 못 박혀 돌아가신 날입니다.",
  부활절: "부활절은 예수님이 죽은 자 가운데서 다시 살아나신 날입니다.",
  승천일: "승천일은 부활하신 예수님이 하늘로 올라가신 날입니다.",
  성령강림절: "성령강림절은 성령이 제자들에게 내리신 날입니다.",
};

export function seasonGuide(title: string): string | null {
  return SEASON_GUIDES[title] ?? null;
}

/** 주간 칸의 짧은 줄입니다. 장소와 시각만 남기고 본문은 넣지 않습니다. */
export function eventSummary(event: CalendarDayEvent): string | null {
  const parts: string[] = [];
  const place = event.placeName?.trim();
  if (place) parts.push(place);
  const clock = seoulClock(event.startAt);
  if (clock) parts.push(clock);
  if (parts.length === 0) return null;
  const text = parts.join(" · ");
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

function rememberMark(marks: DayMark[], seen: Set<string>, date: string, placeKey: string, mark: DayMark) {
  const identity = `${date}\n${placeKey}\n${mark.title}`;
  if (seen.has(identity)) return;
  seen.add(identity);
  marks.push(mark);
}

/** 저장된 일정, 읽어 온 구글 일정, 계산한 교회 절기만 날짜 칸에 놓습니다. 없는 모임은 만들지 않습니다. */
export function monthDayMarks(
  year: number,
  month: number,
  events: readonly CalendarDayEvent[],
  birthdays: readonly BirthdayMark[],
  googleEvents: readonly GoogleEventView[] = [],
): MonthDayCell[] {
  const seasons = churchSeasonMarks(year, month);
  return monthCells(year, month).map((cell) => {
    if (!cell.date || cell.day === null) return { date: null, day: null, marks: [] };
    const marks: DayMark[] = [];
    const seen = new Set<string>();
    const date = cell.date;
    for (const event of events) {
      if (!eventCoversLocalDate(event, date)) continue;
      const place = placeOf(event);
      rememberMark(marks, seen, date, `${place.placeKind ?? ""}:${event.placeId?.trim() || place.placeName || ""}`, {
        key: `event-${event.id}`,
        title: event.title,
        summary: eventSummary(event),
        kind: "event",
        href: `/calendar/${event.id}`,
        leaderOnly: event.isLeaderOnly,
        ...place,
      });
    }
    for (const event of googleEvents) {
      if (!googleEventCoversDate(event, date)) continue;
      const title = event.title || (event.allDay ? "종일" : seoulClock(event.startAt));
      if (!title) continue;
      rememberMark(marks, seen, date, "google:", {
        key: `google-${event.id}`,
        title,
        summary: event.allDay ? null : seoulClock(event.startAt) || null,
        kind: "google",
        href: null,
        leaderOnly: false,
        ...NO_PLACE,
      });
    }
    for (const season of seasons) {
      if (season.date !== date) continue;
      rememberMark(marks, seen, date, "season:", {
        key: `season-${season.date}-${season.title}`,
        title: season.title,
        summary: null,
        kind: "season",
        href: null,
        leaderOnly: false,
        ...NO_PLACE,
      });
    }
    for (const birthday of birthdays) {
      if (birthday.date !== date) continue;
      rememberMark(marks, seen, date, `birthday:${birthday.memberId}`, {
        key: `birthday-${birthday.memberId}`,
        title: birthday.name,
        summary: null,
        kind: "birthday",
        href: null,
        leaderOnly: false,
        ...NO_PLACE,
      });
    }
    return { date, day: cell.day, marks };
  });
}

export type GoogleCalendarReadPlan =
  | { mode: "skip" }
  | { mode: "public"; url: string }
  | { mode: "shared"; url: string }
  | { mode: "public_then_shared"; publicUrl: string; sharedUrl: string };

export function googleCalendarListUrl(calendarId: string, timeMin: string, timeMax: string): string {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("maxResults", "250");
  return url.toString();
}

/**
 * 달력 번호가 없으면 읽지 않습니다.
 * 번호가 있으면 공개 달력은 열쇠로, 서비스 계정에 공유된 달력은 그 계정으로 읽습니다.
 */
export function googleCalendarReadPlan(input: {
  calendarId?: string;
  apiKey?: string;
  hasServiceAccount: boolean;
  timeMin: string;
  timeMax: string;
}): GoogleCalendarReadPlan {
  const calendarId = input.calendarId?.trim() ?? "";
  if (!calendarId) return { mode: "skip" };
  const apiKey = input.apiKey?.trim() ?? "";
  const listUrl = googleCalendarListUrl(calendarId, input.timeMin, input.timeMax);
  if (apiKey && input.hasServiceAccount) {
    return {
      mode: "public_then_shared",
      publicUrl: withGoogleApiKey(listUrl, apiKey),
      sharedUrl: listUrl,
    };
  }
  if (apiKey) return { mode: "public", url: withGoogleApiKey(listUrl, apiKey) };
  if (input.hasServiceAccount) return { mode: "shared", url: listUrl };
  return { mode: "skip" };
}

export function googleCalendarCanWriteFromEnv(env: {
  GOOGLE_CALENDAR_CLIENT_ID?: string;
  GOOGLE_CALENDAR_CLIENT_SECRET?: string;
  GOOGLE_CALENDAR_REFRESH_TOKEN?: string;
  GOOGLE_CALENDAR_ID?: string;
  GOOGLE_CALENDAR_API_KEY?: string;
}): boolean {
  const config = googleCalendarConfigFromEnv(env);
  return Boolean(config?.clientId && config.clientSecret && config.refreshToken && config.calendarId);
}

export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
