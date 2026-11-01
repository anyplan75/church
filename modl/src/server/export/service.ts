/**
 * 교적, 출석, 재정 엑셀을 만듭니다.
 * 사역자와 임원만 받고, 다른 공동체 줄은 넣지 않습니다.
 */

import { eq } from "drizzle-orm";
import { ATTENDANCE_HEADERS, attendanceRows, buildXlsx, FINANCE_HEADERS, financeRows, ROSTER_HEADERS, rosterRows } from "@/export/xlsx";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { attendanceRecords, attendanceSessions, financeCategories, members, transactions } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { FinanceFlowError, readableFinanceError } from "@/server/finance/service";

export function readableExportError(error: unknown): string {
  return readableFinanceError(error);
}

async function requireExport(actor: Actor, kind: "roster" | "attendance" | "finance") {
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new FinanceFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  assertApprovedMember(actor, communityId);
  if (!formalMembership(actor, communityId)) {
    throw new FinanceFlowError("이 공동체 구성원이 아니어서 파일을 받을 수 없습니다.");
  }
  if (kind === "roster") assertCan(actor, { type: "manage_roster", communityId });
  if (kind === "attendance") assertCan(actor, { type: "view_attendance_stats", communityId });
  if (kind === "finance") assertCan(actor, { type: "manage_finance", communityId });
  return communityId;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function rosterWorkbook(): Promise<Buffer> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireExport(actor, "roster");
  const db = getDb();
  const people = await db.select().from(members).where(eq(members.communityId, communityId));
  return buildXlsx("교적", [...ROSTER_HEADERS], rosterRows(people));
}

export async function attendanceWorkbook(): Promise<Buffer> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireExport(actor, "attendance");
  const db = getDb();
  const rows = await db
    .select({
      sessionDate: attendanceSessions.sessionDate,
      title: attendanceSessions.title,
      name: members.name,
      status: attendanceRecords.status,
    })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
    .innerJoin(members, eq(attendanceRecords.memberId, members.id))
    .where(eq(attendanceSessions.communityId, communityId));
  return buildXlsx("출석", [...ATTENDANCE_HEADERS], attendanceRows(rows));
}

export async function financeWorkbook(): Promise<Buffer> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireExport(actor, "finance");
  const db = getDb();
  const categories = await db.select().from(financeCategories).where(eq(financeCategories.communityId, communityId));
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const rows = await db.select().from(transactions).where(eq(transactions.communityId, communityId));
  return buildXlsx(
    "살림",
    [...FINANCE_HEADERS],
    financeRows(
      rows.map((row) => ({
        transactionDate: row.transactionDate,
        categoryName: names.get(row.categoryId) ?? "",
        type: row.type,
        amount: row.amount,
        description: row.description,
        receiptImageUrls: stringList(row.receiptImageUrls),
      })),
    ),
  );
}

export { PermissionError };
