/**
 * 구글 달력에 일정을 보내거나 뺍니다.
 * 네 가지 환경 변수가 모두 있을 때만 부릅니다. 열쇠는 기록으로 남기지 않습니다.
 */

import {
  googleCalendarConfigFromEnv,
  googleDeleteRequest,
  googleEventRequest,
  type GoogleCalendarConfig,
} from "@/calendar/rules";

export class GoogleCalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCalendarError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function readGoogleCalendarConfig(): GoogleCalendarConfig | null {
  return googleCalendarConfigFromEnv({
    GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REFRESH_TOKEN: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
  });
}

async function accessToken(config: GoogleCalendarConfig, fetchImpl: FetchLike): Promise<string> {
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new GoogleCalendarError("구글 달력 열쇠로 접속하지 못했습니다.");
  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || payload.access_token.length === 0) {
    throw new GoogleCalendarError("구글 달력 열쇠로 접속하지 못했습니다.");
  }
  return payload.access_token;
}

export async function pushGoogleEvent(
  config: GoogleCalendarConfig,
  event: { googleEventId: string | null; title: string; startAt: Date; endAt: Date },
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const token = await accessToken(config, fetchImpl);
  const request = googleEventRequest({
    calendarId: config.calendarId,
    googleEventId: event.googleEventId,
    title: event.title,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
  });
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request.body),
  });
  if (!response.ok) throw new GoogleCalendarError("구글 달력에 일정을 보내지 못했습니다.");
  const payload = (await response.json()) as { id?: unknown };
  if (typeof payload.id !== "string" || payload.id.length === 0) {
    throw new GoogleCalendarError("구글 달력이 일정 번호를 주지 않았습니다.");
  }
  return payload.id;
}

export async function removeGoogleEvent(
  config: GoogleCalendarConfig,
  googleEventId: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const token = await accessToken(config, fetchImpl);
  const request = googleDeleteRequest(config.calendarId, googleEventId);
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new GoogleCalendarError("구글 달력에서 일정을 빼지 못했습니다.");
}
