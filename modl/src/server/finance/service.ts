/**
 * 살림 분류와 거래를 저장합니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 줄은 섞지 않습니다.
 */

import { and, eq, inArray } from "drizzle-orm";
import { isHttpUrl, receiptsInRange, textLines } from "@/finance/rules";
import { FINANCE_HEADERS, financeRows } from "@/export/xlsx";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, assertSameCommunity, can, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { canSeeSharedRow } from "@/place/rules";
import { loadPlaceScope, placeCommunity } from "@/server/place/service";
import { communities, financeCategories, mapChurches, smallGroups, transactions } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";
import { appendFinanceRows, readFinanceSheet, sheetsReady } from "@/server/finance/sheets";
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
  const scope = await loadPlaceScope(actor.userId);
  if (scope.churchIds.size === 0 && scope.groupIds.size === 0 && scope.formalCommunityIds.size === 0) {
    return { ok: false as const, message: "속한 교회나 모들이 없습니다." };
  }
  const db = getDb();
  const categoryRows = await db.select().from(financeCategories);
  const visibleCategories = categoryRows.filter((row) => canSeeSharedRow(row, scope.churchIds, scope.groupIds, scope.formalCommunityIds));
  const transactionRows = await db.select().from(transactions);
  const visibleTransactions = transactionRows.filter((row) => canSeeSharedRow(row, scope.churchIds, scope.groupIds, scope.formalCommunityIds));
  const churchRows = scope.churchIds.size
    ? await db.select({ id: mapChurches.id, name: mapChurches.name }).from(mapChurches).where(inArray(mapChurches.id, [...scope.churchIds]))
    : [];
  const groupRows = scope.groupIds.size
    ? await db.select({ id: smallGroups.id, name: smallGroups.name }).from(smallGroups).where(inArray(smallGroups.id, [...scope.groupIds]))
    : [];
  const names = new Map<string, string>([...churchRows.map((row) => [row.id, row.name] as const), ...groupRows.map((row) => [row.id, row.name] as const)]);
  const places = [
    ...churchRows.map((row) => ({ id: row.id, name: row.name, kind: "church" as const, canEdit: scope.editChurchIds.has(row.id) })),
    ...groupRows.map((row) => ({ id: row.id, name: row.name, kind: "gathering" as const, canEdit: scope.editGroupIds.has(row.id) })),
  ].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "church" ? -1 : 1;
    return left.name.localeCompare(right.name, "ko");
  });
  return {
    ok: true as const,
    places,
    categories: visibleCategories.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      placeId: row.groupId ?? row.churchId ?? "",
      placeKind: row.groupId ? ("gathering" as const) : ("church" as const),
      place: row.groupId ? names.get(row.groupId) ?? "모들" : row.churchId ? names.get(row.churchId) ?? "교회" : "기록",
    })),
    transactions: visibleTransactions.map((row) => ({
      id: row.id,
      date: String(row.transactionDate),
      amount: row.amount,
      description: row.description,
      placeId: row.groupId ?? row.churchId ?? "",
      placeKind: row.groupId ? ("gathering" as const) : ("church" as const),
      place: row.groupId ? names.get(row.groupId) ?? "모들" : row.churchId ? names.get(row.churchId) ?? "교회" : "기록",
    })),
  };
}

export async function createCategory(input: {
  departmentOrEvent: string;
  type: "INCOME" | "EXPENSE";
  name: string;
  budgetAmount: string;
  placeKind: "church" | "gathering";
  placeId: string;
}): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") throw new FinanceFlowError("살림을 고치려면 먼저 들어가 주세요.");
  const scope = await loadPlaceScope(actor.userId);
  const allowed = input.placeKind === "gathering" ? scope.editGroupIds.has(input.placeId) : scope.editChurchIds.has(input.placeId);
  if (!allowed) throw new FinanceFlowError("이 재정은 관리자나 수정 권한이 있는 사람만 고칩니다.");
  const budget = Number(input.budgetAmount);
  if (!Number.isInteger(budget) || budget < 0) throw new FinanceFlowError("예산은 0 이상의 정수로 적어 주세요.");
  await assertTextsAllowed(input.departmentOrEvent, input.name);
  const communityId = await placeCommunity(input.placeKind, input.placeId);
  const db = getDb();
  await db.insert(financeCategories).values({
    communityId,
    churchId: input.placeKind === "church" ? input.placeId : null,
    groupId: input.placeKind === "gathering" ? input.placeId : null,
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
  if (actor.kind !== "user") throw new FinanceFlowError("살림을 고치려면 먼저 들어가 주세요.");
  const scope = await loadPlaceScope(actor.userId);
  const db = getDb();
  const [category] = await db.select().from(financeCategories).where(eq(financeCategories.id, input.categoryId)).limit(1);
  if (!category) throw new FinanceFlowError("분류를 찾지 못했습니다.");
  const allowed = category.groupId ? scope.editGroupIds.has(category.groupId) : category.churchId ? scope.editChurchIds.has(category.churchId) : false;
  if (!allowed) throw new FinanceFlowError("이 재정은 관리자나 수정 권한이 있는 사람만 고칩니다.");
  const membership = formalMembership(actor, category.communityId);
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount < 0) throw new FinanceFlowError("금액은 0 이상의 정수로 적어 주세요.");
  const receiptImageUrls = textLines(input.receiptText);
  for (const url of receiptImageUrls) {
    if (!isHttpUrl(url) && !url.startsWith("/")) {
      throw new FinanceFlowError("영수증 주소는 http 로 시작하거나 / 로 시작하는 경로여야 합니다.");
    }
  }
  await assertTextsAllowed(input.description, receiptImageUrls);
  await db.insert(transactions).values({
    communityId: category.communityId,
    churchId: category.churchId,
    groupId: category.groupId,
    categoryId: category.id,
    transactionDate: input.transactionDate,
    type: category.type,
    amount: String(amount),
    description: input.description.trim(),
    receiptImageUrls,
    recordedBy: membership?.memberId ?? null,
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
