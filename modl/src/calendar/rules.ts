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
