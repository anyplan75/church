/**
 * 살림 막대, 영수증 기간, 구글 시트 설정입니다.
 * 데이터베이스에 접속하지 않습니다. 열쇠 값은 여기서 만들지 않습니다.
 */

import type { Actor, MemberRole } from "@/server/auth/actor";
import { can } from "@/server/auth/rbac";

export type ReceiptSource = {
  transactionDate: string;
  receiptImageUrls: readonly string[];
};

export type BudgetBar = {
  spent: number;
  budget: number;
  percent: number;
  width: number;
  hasBudget: boolean;
};

/** 지출을 예산으로 나눈 비율입니다. 막대 너비는 100을 넘지 않습니다. */
export function budgetBar(spent: number, budget: number): BudgetBar {
  const safeSpent = Number.isFinite(spent) && spent > 0 ? Math.round(spent) : 0;
  const safeBudget = Number.isFinite(budget) && budget > 0 ? Math.round(budget) : 0;
  if (safeBudget === 0) {
    return { spent: safeSpent, budget: 0, percent: 0, width: 0, hasBudget: false };
  }
  const percent = Math.round((safeSpent / safeBudget) * 100);
  return {
    spent: safeSpent,
    budget: safeBudget,
    percent,
    width: Math.min(100, percent),
    hasBudget: true,
  };
}

/** 시작일과 종료일 안의 영수증 주소만 고릅니다. 날짜는 시작과 끝을 포함합니다. */
export function receiptsInRange(rows: readonly ReceiptSource[], start: string, end: string): string[] {
  const urls: string[] = [];
  for (const row of rows) {
    if (row.transactionDate < start || row.transactionDate > end) continue;
    for (const url of row.receiptImageUrls) {
      const trimmed = url.trim();
      if (trimmed) urls.push(trimmed);
    }
  }
  return urls;
}

export function textLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** 사역자와 임원만 재정을 다룹니다. 다른 공동체는 막습니다. */
export function canManageFinance(actor: Actor, communityId: string): boolean {
  return can(actor, { type: "manage_finance", communityId });
}

export function canManageFinanceRole(role: MemberRole | null): boolean {
  return role === "PASTOR" || role === "EXECUTIVE";
}

export type GoogleSheetsConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  spreadsheetId: string;
};

/**
 * 구글 시트 이름 네 개가 모두 있어야 설정을 만듭니다.
 * 호출하는 쪽에서 그 칸만 넘겨 주세요.
 */
export function googleSheetsConfigFromEnv(env: {
  GOOGLE_SHEETS_CLIENT_ID?: string;
  GOOGLE_SHEETS_CLIENT_SECRET?: string;
  GOOGLE_SHEETS_REFRESH_TOKEN?: string;
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
}): GoogleSheetsConfig | null {
  const clientId = env.GOOGLE_SHEETS_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_SHEETS_CLIENT_SECRET?.trim() ?? "";
  const refreshToken = env.GOOGLE_SHEETS_REFRESH_TOKEN?.trim() ?? "";
  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
  if (!clientId || !clientSecret || !refreshToken || !spreadsheetId) return null;
  return { clientId, clientSecret, refreshToken, spreadsheetId };
}

/** 칸에 적힌 금액인지 봅니다. 비어 있으면 금액이 아닙니다. */
export function cellHasAmount(value: string): boolean {
  const cleaned = value.replace(/,/g, "").replace(/원/g, "").replace(/\s/g, "").trim();
  if (!cleaned) return false;
  return /^-?\d+(\.\d+)?$/.test(cleaned);
}

/**
 * 시트에 있는 금액 줄만 고릅니다.
 * 첫 줄에 금액이 없으면 제목 줄로 둡니다. 빈 칸은 0으로 채우지 않습니다.
 */
export function amountsFromSheet(values: unknown): { headers: string[]; rows: string[][] } | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  const grid = values.map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? "" : String(cell))) : []));
  const first = grid[0] ?? [];
  const firstHasAmount = first.some((cell) => cellHasAmount(cell));
  const headers = firstHasAmount ? [] : first;
  const body = firstHasAmount ? grid : grid.slice(1);
  const rows = body.filter((row) => row.some((cell) => cellHasAmount(cell)));
  if (rows.length === 0) return null;
  return { headers, rows };
}

export function sheetsAppendRequest(input: {
  spreadsheetId: string;
  sheetName: string;
  rows: string[][];
}): { method: "POST"; url: string; body: { values: string[][] } } {
  const sheet = encodeURIComponent(input.sheetName);
  return {
    method: "POST",
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.spreadsheetId)}/values/${sheet}!A1:append?valueInputOption=RAW`,
    body: { values: input.rows },
  };
}
