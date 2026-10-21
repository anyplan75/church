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
  kind: "event" | "birthday" | "google";
  href: string | null;
  leaderOnly: boolean;
};

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

/** 저장된 일정과 읽어 온 구글 일정만 날짜 칸에 놓습니다. 없는 일정은 만들지 않습니다. */
export function monthDayMarks(
  year: number,
  month: number,
  events: readonly CalendarDayEvent[],
  birthdays: readonly BirthdayMark[],
  googleEvents: readonly GoogleEventView[] = [],
): MonthDayCell[] {
  return monthCells(year, month).map((cell) => {
    if (!cell.date || cell.day === null) return { date: null, day: null, marks: [] };
    const marks: DayMark[] = [];
    for (const event of events) {
      if (!eventCoversLocalDate(event, cell.date)) continue;
      marks.push({
        key: `event-${event.id}`,
        title: event.title,
        kind: "event",
        href: `/calendar/${event.id}`,
        leaderOnly: event.isLeaderOnly,
      });
    }
    for (const event of googleEvents) {
      if (!googleEventCoversDate(event, cell.date)) continue;
      const title = event.title || (event.allDay ? "종일" : seoulClock(event.startAt));
      if (!title) continue;
      marks.push({
        key: `google-${event.id}`,
        title,
        kind: "google",
        href: null,
        leaderOnly: false,
      });
    }
    for (const birthday of birthdays) {
      if (birthday.date !== cell.date) continue;
      marks.push({
        key: `birthday-${birthday.memberId}`,
        title: birthday.name,
        kind: "birthday",
        href: null,
        leaderOnly: false,
      });
    }
    return { date: cell.date, day: cell.day, marks };
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
