/**
 * 재정 내역을 구글 시트에 보냅니다.
 * 열쇠 네 개가 있을 때만 부릅니다. 열쇠는 기록으로 남기지 않습니다.
 */

import { createSign } from "node:crypto";
import {
  amountsFromSheet,
  financeEntriesFromSheet,
  googleSheetsConfigFromEnv,
  sheetsAppendRequest,
  type FinanceSheetEntry,
} from "@/finance/rules";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function readConfig() {
  return googleSheetsConfigFromEnv({
    GOOGLE_SHEETS_CLIENT_ID: process.env.GOOGLE_SHEETS_CLIENT_ID,
    GOOGLE_SHEETS_CLIENT_SECRET: process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    GOOGLE_SHEETS_REFRESH_TOKEN: process.env.GOOGLE_SHEETS_REFRESH_TOKEN,
    GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  });
}

export function sheetsReady(): boolean {
  return readConfig() !== null;
}

async function accessToken(
  config: NonNullable<ReturnType<typeof readConfig>>,
  fetchImpl: FetchLike,
): Promise<string | null> {
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
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function appendFinanceRows(rows: string[][], fetchImpl: FetchLike = fetch): Promise<"sent" | "missing" | "failed"> {
  const config = readConfig();
  if (!config) return "missing";
  const token = await accessToken(config, fetchImpl);
  if (!token) return "failed";
  const request = sheetsAppendRequest({
    spreadsheetId: config.spreadsheetId,
    sheetName: "살림",
    rows,
  });
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request.body),
  });
  if (!response.ok) return "failed";
  return "sent";
}

const SHEET_TAB = "시트1";
const READ_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

type ServiceAccount = { email: string; privateKey: string };

export function serviceAccountFromEnv(raw: string | undefined): ServiceAccount | null {
  const text = raw?.trim() ?? "";
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { client_email?: unknown; private_key?: unknown };
  const email = typeof record.client_email === "string" ? record.client_email.trim() : "";
  const privateKey = typeof record.private_key === "string" ? record.private_key : "";
  if (!email || !privateKey.includes("PRIVATE KEY")) return null;
  return { email, privateKey };
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function serviceAccountJwt(account: ServiceAccount, nowSeconds: number): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: account.email,
      scope: READ_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(account.privateKey).toString("base64url")}`;
}

export type FinanceSheetView =
  | { state: "ready"; headers: string[]; rows: string[][]; entries: FinanceSheetEntry[] }
  | { state: "empty" }
  | { state: "missing" }
  | { state: "failed" };

/** 시트1에 있는 금액만 읽습니다. 쓰거나, 빈 칸을 0으로 만들지 않습니다. */
export async function readFinanceSheet(fetchImpl: FetchLike = fetch): Promise<FinanceSheetView> {
  const account = serviceAccountFromEnv(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT);
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
  if (!account || !spreadsheetId) return { state: "missing" };
  try {
    const assertion = serviceAccountJwt(account, Math.floor(Date.now() / 1000));
    const tokenResponse = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!tokenResponse.ok) return { state: "failed" };
    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    const token = tokenJson.access_token;
    if (!token) return { state: "failed" };
    const range = encodeURIComponent(SHEET_TAB);
    const sheetResponse = await fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!sheetResponse.ok) return { state: "failed" };
    const sheetJson = (await sheetResponse.json()) as { values?: unknown };
    const parsed = amountsFromSheet(sheetJson.values);
    if (!parsed) return { state: "empty" };
    return {
      state: "ready",
      headers: parsed.headers,
      rows: parsed.rows,
      entries: financeEntriesFromSheet(sheetJson.values),
    };
  } catch {
    return { state: "failed" };
  }
}
