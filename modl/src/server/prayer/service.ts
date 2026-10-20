/**
 * 기도 글을 저장하고, 역할과 모들로 거른 뒤 화면에 내려 줍니다.
 * 익명이면 작성자가 아닌 응답에서 작성자 정보를 뺍니다.
 * 권한은 assertCan 과 visiblePrayerFilter, toPrayerDto 만 씁니다.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { letterRecipientLabel, nextPrayTogetherCount } from "@/prayer/rules";
import type { Actor, PrayerVisibility } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { filterVisiblePrayers, toPrayerDto, type PrayerRecord } from "@/server/auth/prayer-visibility";
import { assertApprovedMember, assertCan, assertSameCommunity, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, members, prayerLetters, prayerReactions, prayerRequests } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";

export class PrayerFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrayerFlowError";
  }
}

export function readablePrayerError(error: unknown): string {
  if (error instanceof PrayerFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "기도를 처리하지 못했습니다.";
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const current = error as { code?: unknown; cause?: unknown };
  if (current.code === "23505") return true;
  return isUniqueViolation(current.cause);
}

async function requireCommunity(actor: Actor): Promise<string> {
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    throw new PrayerFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  }
  return communityId;
}

async function requireMember(actor: Actor, communityId: string) {
  assertApprovedMember(actor, communityId);
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    throw new PrayerFlowError("승인 대기 중이거나 이 공동체 구성원이 아니어서 기도를 볼 수 없습니다.");
  }
  return membership;
}

async function loadCommunityPage(actor: Actor) {
  if (actor.kind !== "user") {
    return { ok: false as const, message: "기도를 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 기도를 볼 수 없습니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  return { ok: true as const, actor, communityId, membership, communityName: community.name, db };
}

export async function loadPrayerHome() {
  await ensureDatabase();
  const actor = await loadActor();
  const page = await loadCommunityPage(actor);
  if (!page.ok) return page;
  const rows = await page.db
    .select({
      id: prayerRequests.id,
      communityId: prayerRequests.communityId,
      memberId: prayerRequests.memberId,
      groupId: prayerRequests.groupId,
      content: prayerRequests.content,
      isAnonymous: prayerRequests.isAnonymous,
      visibility: prayerRequests.visibility,
      prayTogetherCount: prayerRequests.prayTogetherCount,
      createdAt: prayerRequests.createdAt,
      authorName: members.name,
    })
    .from(prayerRequests)
    .innerJoin(members, and(eq(prayerRequests.memberId, members.id), eq(members.communityId, page.communityId)))
    .where(eq(prayerRequests.communityId, page.communityId))
    .orderBy(desc(prayerRequests.createdAt));
  const records: Array<PrayerRecord & { authorName: string }> = rows.map((row) => ({
    id: row.id,
    communityId: row.communityId,
    memberId: row.memberId,
    groupId: row.groupId,
    content: row.content,
    isAnonymous: row.isAnonymous,
    visibility: row.visibility,
    prayTogetherCount: row.prayTogetherCount,
    createdAt: row.createdAt.toISOString(),
    authorName: row.authorName,
  }));
  const visible = filterVisiblePrayers(page.actor, records);
  const reacted = await page.db
    .select({ prayerRequestId: prayerReactions.prayerRequestId })
    .from(prayerReactions)
    .innerJoin(prayerRequests, eq(prayerReactions.prayerRequestId, prayerRequests.id))
    .where(and(eq(prayerReactions.memberId, page.membership.memberId), eq(prayerRequests.communityId, page.communityId)));
  const reactedIds = new Set(reacted.map((row) => row.prayerRequestId));
  return {
    ok: true as const,
    communityName: page.communityName,
    items: visible.map((row) => {
      const dto = toPrayerDto(row, page.actor);
      return {
        id: dto.id,
        content: dto.content,
        isAnonymous: dto.isAnonymous,
        visibility: dto.visibility,
        prayTogetherCount: dto.prayTogetherCount,
        authorName: dto.authorMemberId ? row.authorName : null,
        alreadyPrayed: reactedIds.has(dto.id),
      };
    }),
  };
}

export async function createPrayer(input: {
  content: string;
  visibility: PrayerVisibility;
  isAnonymous: boolean;
}): Promise<string> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = await requireMember(actor, communityId);
  if ((input.visibility === "GROUP_ONLY" || input.visibility === "LEADER_ONLY") && !membership.currentGroupId) {
    throw new PrayerFlowError("모들만 또는 테우리만으로 쓰려면 소속 모들이 있어야 합니다.");
  }
  const groupId =
    input.visibility === "GROUP_ONLY" || input.visibility === "LEADER_ONLY" ? membership.currentGroupId : membership.currentGroupId;
  assertCan(actor, {
    type: "write_prayer",
    communityId,
    visibility: input.visibility,
    groupId: input.visibility === "PUBLIC" || input.visibility === "PASTOR_ONLY" ? null : groupId,
  });
  const db = getDb();
  const [created] = await db
    .insert(prayerRequests)
    .values({
      communityId,
      memberId: membership.memberId,
      groupId,
      content: input.content.trim(),
      isAnonymous: input.isAnonymous,
      visibility: input.visibility,
    })
    .returning({ id: prayerRequests.id });
  if (!created) throw new PrayerFlowError("기도를 저장하지 못했습니다.");
  return created.id;
}

export async function prayTogether(prayerId: string): Promise<"added" | "kept"> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = await requireMember(actor, communityId);
  const db = getDb();
  const [row] = await db.select().from(prayerRequests).where(eq(prayerRequests.id, prayerId)).limit(1);
  if (!row) throw new PrayerFlowError("기도 글을 찾지 못했습니다.");
  assertSameCommunity(row.communityId, communityId);
  const record: PrayerRecord = {
    id: row.id,
    communityId: row.communityId,
    memberId: row.memberId,
    groupId: row.groupId,
    content: row.content,
    isAnonymous: row.isAnonymous,
    visibility: row.visibility,
    prayTogetherCount: row.prayTogetherCount,
    createdAt: row.createdAt.toISOString(),
  };
  const [visible] = filterVisiblePrayers(actor, [record]);
  if (!visible) throw new PrayerFlowError("이 기도 글은 볼 수 없습니다.");

  try {
    await db.transaction(async (tx) => {
      await tx.insert(prayerReactions).values({
        prayerRequestId: row.id,
        memberId: membership.memberId,
      });
      await tx
        .update(prayerRequests)
        .set({
          prayTogetherCount: sql`${prayerRequests.prayTogetherCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(prayerRequests.id, row.id));
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "kept";
    throw error;
  }
  return nextPrayTogetherCount(row.prayTogetherCount, false) === row.prayTogetherCount + 1 ? "added" : "kept";
}

async function visiblePrayerOrThrow(actor: Actor, communityId: string, prayerId: string) {
  const db = getDb();
  const [row] = await db.select().from(prayerRequests).where(eq(prayerRequests.id, prayerId)).limit(1);
  if (!row) throw new PrayerFlowError("기도 글을 찾지 못했습니다.");
  assertSameCommunity(row.communityId, communityId);
  const record: PrayerRecord = {
    id: row.id,
    communityId: row.communityId,
    memberId: row.memberId,
    groupId: row.groupId,
    content: row.content,
    isAnonymous: row.isAnonymous,
    visibility: row.visibility,
    prayTogetherCount: row.prayTogetherCount,
    createdAt: row.createdAt.toISOString(),
  };
  const [visible] = filterVisiblePrayers(actor, [record]);
  if (!visible) throw new PrayerFlowError("이 기도 글은 볼 수 없습니다.");
  return row;
}

export async function sendPrayerLetter(input: { prayerId: string; message: string }): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = await requireMember(actor, communityId);
  const prayer = await visiblePrayerOrThrow(actor, communityId, input.prayerId);
  const db = getDb();
  await db.insert(prayerLetters).values({
    prayerRequestId: prayer.id,
    senderMemberId: membership.memberId,
    receiverMemberId: prayer.memberId,
    message: input.message.trim(),
  });
}

export async function loadPrayerLetters() {
  await ensureDatabase();
  const actor = await loadActor();
  const page = await loadCommunityPage(actor);
  if (!page.ok) return page;
  const authors = alias(members, "prayer_authors");
  const senders = alias(members, "letter_senders");
  const rows = await page.db
    .select({
      id: prayerLetters.id,
      message: prayerLetters.message,
      isRead: prayerLetters.isRead,
      isAnonymous: prayerRequests.isAnonymous,
      authorName: authors.name,
      senderName: senders.name,
      senderMemberId: prayerLetters.senderMemberId,
      receiverMemberId: prayerLetters.receiverMemberId,
    })
    .from(prayerLetters)
    .innerJoin(prayerRequests, eq(prayerLetters.prayerRequestId, prayerRequests.id))
    .innerJoin(authors, and(eq(prayerRequests.memberId, authors.id), eq(authors.communityId, page.communityId)))
    .innerJoin(senders, and(eq(prayerLetters.senderMemberId, senders.id), eq(senders.communityId, page.communityId)))
    .where(eq(prayerRequests.communityId, page.communityId))
    .orderBy(desc(prayerLetters.createdAt));
  const memberId = page.membership.memberId;
  return {
    ok: true as const,
    communityName: page.communityName,
    inbox: rows
      .filter((row) => row.receiverMemberId === memberId)
      .map((row) => ({
        id: row.id,
        message: row.message,
        isRead: row.isRead,
        senderName: row.senderName,
      })),
    sent: rows
      .filter((row) => row.senderMemberId === memberId)
      .map((row) => ({
        id: row.id,
        message: row.message,
        recipientName: letterRecipientLabel({ isAnonymous: row.isAnonymous, authorName: row.authorName }),
      })),
  };
}

export async function markLetterRead(letterId: string): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = await requireMember(actor, communityId);
  const db = getDb();
  const [row] = await db
    .select({
      id: prayerLetters.id,
      receiverMemberId: prayerLetters.receiverMemberId,
      communityId: prayerRequests.communityId,
    })
    .from(prayerLetters)
    .innerJoin(prayerRequests, eq(prayerLetters.prayerRequestId, prayerRequests.id))
    .where(eq(prayerLetters.id, letterId))
    .limit(1);
  if (!row) throw new PrayerFlowError("기별을 찾지 못했습니다.");
  assertSameCommunity(row.communityId, communityId);
  if (row.receiverMemberId !== membership.memberId) {
    throw new PrayerFlowError("받은 기별만 읽음으로 둘 수 있습니다.");
  }
  await db
    .update(prayerLetters)
    .set({ isRead: true, updatedAt: new Date() })
    .where(and(eq(prayerLetters.id, row.id), eq(prayerLetters.receiverMemberId, membership.memberId)));
}
