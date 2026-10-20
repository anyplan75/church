/**
 * 재정 내역을 구글 시트에 보냅니다.
 * 열쇠 네 개가 있을 때만 부릅니다. 열쇠는 기록으로 남기지 않습니다.
 */

import { googleSheetsConfigFromEnv, sheetsAppendRequest } from "@/finance/rules";

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
