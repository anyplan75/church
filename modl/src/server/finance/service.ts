/**
 * 살림 분류와 거래를 저장합니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 줄은 섞지 않습니다.
 */

import { and, asc, eq } from "drizzle-orm";
import { budgetBar, isHttpUrl, receiptsInRange, textLines } from "@/finance/rules";
import { FINANCE_HEADERS, financeRows } from "@/export/xlsx";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, assertSameCommunity, can, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, financeCategories, transactions } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { appendFinanceRows, sheetsReady } from "@/server/finance/sheets";
import { zipReceiptFiles } from "@/server/finance/zip";

export class FinanceFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceFlowError";
  }
}

export function readableFinanceError(error: unknown): string {
  if (error instanceof FinanceFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "살림을 처리하지 못했습니다.";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function requireOfficer(actor: Actor, communityId: string) {
  assertApprovedMember(actor, communityId);
  const membership = formalMembership(actor, communityId);
  if (!membership) throw new FinanceFlowError("이 공동체 구성원이 아니어서 살림을 볼 수 없습니다.");
  assertCan(actor, { type: "manage_finance", communityId });
  return membership;
}

export async function loadFinanceHome() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "살림을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 살림을 볼 수 없습니다." };
  }
  if (!can(actor, { type: "manage_finance", communityId })) {
    return { ok: false as const, message: "살림은 사역자와 임원만 봅니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const categories = await db
    .select()
    .from(financeCategories)
    .where(eq(financeCategories.communityId, communityId))
    .orderBy(asc(financeCategories.name));
  const rows = await db.select().from(transactions).where(eq(transactions.communityId, communityId));
  return {
    ok: true as const,
    communityName: community.name,
    sheetsReady: sheetsReady(),
    categories: categories.map((category) => {
      const spent = rows
        .filter((row) => row.categoryId === category.id && row.type === category.type)
        .reduce((sum, row) => sum + Number(row.amount), 0);
      return {
        id: category.id,
        name: category.name,
        departmentOrEvent: category.departmentOrEvent,
        type: category.type,
        bar: budgetBar(spent, Number(category.budgetAmount)),
      };
    }),
    transactions: rows
      .map((row) => ({
        id: row.id,
        transactionDate: row.transactionDate,
        categoryId: row.categoryId,
        categoryName: categories.find((category) => category.id === row.categoryId)?.name ?? "",
        type: row.type,
        amount: row.amount,
        description: row.description,
        receiptCount: stringList(row.receiptImageUrls).length,
      }))
      .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate)),
  };
}

export async function createCategory(input: {
  departmentOrEvent: string;
  type: "INCOME" | "EXPENSE";
  name: string;
  budgetAmount: string;
}): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new FinanceFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  await requireOfficer(actor, communityId);
  const budget = Number(input.budgetAmount);
  if (!Number.isInteger(budget) || budget < 0) throw new FinanceFlowError("예산은 0 이상의 정수로 적어 주세요.");
  const db = getDb();
  await db.insert(financeCategories).values({
    communityId,
    departmentOrEvent: input.departmentOrEvent.trim(),
    type: input.type,
    name: input.name.trim(),
    budgetAmount: String(budget),
  });
}

export async function createTransaction(input: {
  categoryId: string;
  transactionDate: string;
  amount: string;
  description: string;
  receiptText: string;
}): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new FinanceFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  const membership = await requireOfficer(actor, communityId);
  const db = getDb();
  const [category] = await db.select().from(financeCategories).where(eq(financeCategories.id, input.categoryId)).limit(1);
  if (!category) throw new FinanceFlowError("분류를 찾지 못했습니다.");
  assertSameCommunity(category.communityId, communityId);
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount < 0) throw new FinanceFlowError("금액은 0 이상의 정수로 적어 주세요.");
  const receiptImageUrls = textLines(input.receiptText);
  for (const url of receiptImageUrls) {
    if (!isHttpUrl(url) && !url.startsWith("/")) {
      throw new FinanceFlowError("영수증 주소는 http 로 시작하거나 / 로 시작하는 경로여야 합니다.");
    }
  }
  await db.insert(transactions).values({
    communityId,
    categoryId: category.id,
    transactionDate: input.transactionDate,
    type: category.type,
    amount: String(amount),
    description: input.description.trim(),
    receiptImageUrls,
    recordedBy: membership.memberId,
  });
}

export async function financeSheetRows(communityId: string): Promise<string[][]> {
  const db = getDb();
  const categories = await db.select().from(financeCategories).where(eq(financeCategories.communityId, communityId));
  const rows = await db.select().from(transactions).where(eq(transactions.communityId, communityId));
  const names = new Map(categories.map((category) => [category.id, category.name]));
  return [
    [...FINANCE_HEADERS],
    ...financeRows(
      rows.map((row) => ({
        transactionDate: row.transactionDate,
        categoryName: names.get(row.categoryId) ?? "",
        type: row.type,
        amount: row.amount,
        description: row.description,
        receiptImageUrls: stringList(row.receiptImageUrls),
      })),
    ),
  ];
}

export async function syncFinanceToSheets(): Promise<"sent" | "missing" | "failed"> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new FinanceFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  await requireOfficer(actor, communityId);
  if (!sheetsReady()) return "missing";
  return appendFinanceRows(await financeSheetRows(communityId));
}

export async function buildReceiptZip(start: string, end: string): Promise<
  | { ok: true; bytes: Buffer }
  | { ok: false; note: "no_receipts" | "receipts_unreadable" }
> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new FinanceFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  await requireOfficer(actor, communityId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    throw new FinanceFlowError("시작일과 종료일을 확인해 주세요.");
  }
  const db = getDb();
  const rows = await db
    .select({
      transactionDate: transactions.transactionDate,
      receiptImageUrls: transactions.receiptImageUrls,
      communityId: transactions.communityId,
    })
    .from(transactions)
    .where(and(eq(transactions.communityId, communityId)));
  const urls = receiptsInRange(
    rows.map((row) => ({
      transactionDate: row.transactionDate,
      receiptImageUrls: stringList(row.receiptImageUrls),
    })),
    start,
    end,
  );
  if (urls.length === 0) return { ok: false, note: "no_receipts" };
  const bytes = await zipReceiptFiles(urls);
  if (!bytes) return { ok: false, note: "receipts_unreadable" };
  return { ok: true, bytes };
}
