/**
 * 구글 달력에 일정을 보내거나 읽고 뺍니다.
 * 달력 번호가 없으면 부르지 않습니다. 열쇠와 번호는 기록으로 남기지 않습니다.
 * 읽기는 공개 달력이면 열쇠로, 서비스 계정에 공유된 달력이면 그 계정으로 합니다.
 */

import { createSign } from "node:crypto";
import {
  googleCalendarCanWriteFromEnv,
  googleCalendarConfigFromEnv,
  googleCalendarReadPlan,
  googleCalendarWaitFromEnv,
  googleDeleteRequest,
  googleEventRequest,
  withGoogleApiKey,
  type GoogleCalendarConfig,
  type GoogleCalendarWait,
  type GoogleEventView,
} from "@/calendar/rules";

export class GoogleCalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCalendarError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function calendarEnv() {
  return {
    GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REFRESH_TOKEN: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
    GOOGLE_CALENDAR_API_KEY: process.env.GOOGLE_CALENDAR_API_KEY,
  };
}

export function readGoogleCalendarConfig(): GoogleCalendarConfig | null {
  return googleCalendarConfigFromEnv(calendarEnv());
}

export function readGoogleCalendarWait(): GoogleCalendarWait {
  return googleCalendarWaitFromEnv(calendarEnv());
}

export function readGoogleCalendarCanWrite(): boolean {
  return googleCalendarCanWriteFromEnv(calendarEnv());
}

export function readGoogleCalendarHasId(): boolean {
  return Boolean(process.env.GOOGLE_CALENDAR_ID?.trim());
}

export type GoogleCalendarReadResult = {
  status: "skipped" | "ok" | "empty" | "needs_share" | "failed";
  items: GoogleEventView[];
};

export type ServiceAccount = {
  clientEmail: string;
  privateKey: string;
};

function readServiceAccount(raw: string | undefined): ServiceAccount | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  let json = trimmed;
  if (!trimmed.startsWith("{")) {
    try {
      json = Buffer.from(trimmed, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(json) as { client_email?: unknown; private_key?: unknown };
    if (typeof parsed.client_email !== "string" || !parsed.client_email.includes("@")) return null;
    if (typeof parsed.private_key !== "string" || !parsed.private_key.includes("PRIVATE KEY")) return null;
    return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
  } catch {
    return null;
  }
}

export function buildServiceAccountAssertion(account: ServiceAccount, now: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: account.clientEmail,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(account.privateKey).toString("base64url")}`;
}

async function serviceAccountAccessToken(account: ServiceAccount, fetchImpl: FetchLike): Promise<string | null> {
  let assertion = "";
  try {
    assertion = buildServiceAccountAssertion(account, Date.now());
  } catch {
    return null;
  }
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || payload.access_token.length === 0) return null;
  return payload.access_token;
}

function parseGoogleItems(value: unknown): GoogleEventView[] {
  if (!Array.isArray(value)) return [];
  const items: GoogleEventView[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as {
      id?: unknown;
      status?: unknown;
      summary?: unknown;
      start?: { date?: unknown; dateTime?: unknown };
      end?: { date?: unknown; dateTime?: unknown };
    };
    if (row.status === "cancelled") continue;
    const title = typeof row.summary === "string" ? row.summary.trim() : "";
    const id = typeof row.id === "string" && row.id ? row.id : "";
    if (typeof row.start?.date === "string") {
      const startAt = row.start.date;
      const endAt = typeof row.end?.date === "string" ? row.end.date : startAt;
      if (!id && !title) continue;
      items.push({ id: id || `${startAt}:${title}`, title, startAt, endAt, allDay: true });
      continue;
    }
    if (typeof row.start?.dateTime === "string" && typeof row.end?.dateTime === "string") {
      if (!id && !title) continue;
      items.push({
        id: id || `${row.start.dateTime}:${title}`,
        title,
        startAt: row.start.dateTime,
        endAt: row.end.dateTime,
        allDay: false,
      });
    }
  }
  return items;
}

async function readEventPages(
  url: string,
  headers: Record<string, string>,
  fetchImpl: FetchLike,
): Promise<{ status: number; items: GoogleEventView[] }> {
  const items: GoogleEventView[] = [];
  let next: string | null = url;
  for (let page = 0; page < 8 && next; page += 1) {
    let response: Response;
    try {
      response = await fetchImpl(next, { headers });
    } catch {
      return { status: items.length > 0 ? 200 : 0, items };
    }
    if (!response.ok) return { status: response.status, items: page === 0 ? [] : items };
    let payload: { items?: unknown; nextPageToken?: unknown };
    try {
      payload = (await response.json()) as { items?: unknown; nextPageToken?: unknown };
    } catch {
      return { status: 200, items };
    }
    items.push(...parseGoogleItems(payload.items));
    const pageToken = payload.nextPageToken;
    if (typeof pageToken !== "string" || pageToken.length === 0) break;
    const current = next;
    const pageUrl: URL = new URL(current);
    pageUrl.searchParams.set("pageToken", pageToken);
    next = pageUrl.toString();
  }
  return { status: 200, items };
}

function finishRead(items: GoogleEventView[]): GoogleCalendarReadResult {
  return { status: items.length > 0 ? "ok" : "empty", items };
}

/** 구글 달력의 실제 일정만 읽습니다. 일정을 만들거나 저장하지 않습니다. */
export async function readGoogleCalendarMonth(
  timeMin: string,
  timeMax: string,
  fetchImpl: FetchLike = fetch,
): Promise<GoogleCalendarReadResult> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim() ?? "";
  if (!calendarId) return { status: "skipped", items: [] };
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY?.trim() ?? "";
  const account = readServiceAccount(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT);
  const plan = googleCalendarReadPlan({
    calendarId,
    apiKey,
    hasServiceAccount: Boolean(account),
    timeMin,
    timeMax,
  });
  if (plan.mode === "skip") return { status: "skipped", items: [] };

  if (plan.mode === "public" || plan.mode === "public_then_shared") {
    const url = plan.mode === "public" ? plan.url : plan.publicUrl;
    const result = await readEventPages(url, {}, fetchImpl);
    if (result.status === 200) return finishRead(result.items);
    const blocked = result.status === 403 || result.status === 404;
    if (plan.mode === "public" || !blocked) {
      return { status: blocked ? "needs_share" : "failed", items: [] };
    }
  }

  if (!account || (plan.mode !== "shared" && plan.mode !== "public_then_shared")) {
    return { status: "needs_share", items: [] };
  }
  const token = await serviceAccountAccessToken(account, fetchImpl);
  if (!token) return { status: "failed", items: [] };
  const url = plan.mode === "shared" ? plan.url : plan.sharedUrl;
  const result = await readEventPages(url, { authorization: `Bearer ${token}` }, fetchImpl);
  if (result.status === 200) return finishRead(result.items);
  if (result.status === 403 || result.status === 404) return { status: "needs_share", items: [] };
  return { status: "failed", items: [] };
}

async function requestHeaders(config: GoogleCalendarConfig, fetchImpl: FetchLike): Promise<Record<string, string>> {
  if (!config.clientId || !config.clientSecret || !config.refreshToken) return {};
  const token = await accessToken(config, fetchImpl);
  return { authorization: `Bearer ${token}` };
}

async function accessToken(config: GoogleCalendarConfig, fetchImpl: FetchLike): Promise<string> {
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new GoogleCalendarError("구글 달력 열쇠로 접속하지 못했습니다.");
  }
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
  const headers = await requestHeaders(config, fetchImpl);
  const request = googleEventRequest({
    calendarId: config.calendarId,
    googleEventId: event.googleEventId,
    title: event.title,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
  });
  const response = await fetchImpl(withGoogleApiKey(request.url, config.apiKey), {
    method: request.method,
    headers: {
      ...headers,
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
  const headers = await requestHeaders(config, fetchImpl);
  const request = googleDeleteRequest(config.calendarId, googleEventId);
  const response = await fetchImpl(withGoogleApiKey(request.url, config.apiKey), {
    method: request.method,
    headers,
  });
  if (!response.ok) throw new GoogleCalendarError("구글 달력에서 일정을 빼지 못했습니다.");
}
