/**
 * 기도 글을 저장하고, 역할과 모들로 거른 뒤 화면에 내려 줍니다.
 * 익명이면 작성자가 아닌 응답에서 작성자 정보를 뺍니다.
 * 권한은 assertCan 과 visiblePrayerFilter, toPrayerDto 만 씁니다.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { letterRecipientLabel, nextPrayTogetherCount } from "@/prayer/rules";
import { canSeePrayerScope, isPrayerScope, prayerScopeLabel, type PrayerScope } from "@/prayer/scopes";
import type { Actor, PrayerVisibility } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { filterVisiblePrayers, toPrayerDto, type PrayerRecord } from "@/server/auth/prayer-visibility";
import { assertApprovedMember, assertCan, assertSameCommunity, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, mapChurches, members, prayerLetters, prayerReactions, prayerRequests } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";
import { currentChurchIdFor, loadPlaceScope } from "@/server/place/service";

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
      churchId: prayerRequests.churchId,
      scope: prayerRequests.scope,
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
  const records = rows.map((row) => ({
    id: row.id,
    communityId: row.communityId,
    memberId: row.memberId,
    groupId: row.groupId,
    churchId: row.churchId,
    scope: row.scope,
    content: row.content,
    isAnonymous: row.isAnonymous,
    visibility: row.visibility,
    prayTogetherCount: row.prayTogetherCount,
    createdAt: row.createdAt.toISOString(),
    authorName: row.authorName,
  }));
  const place = await loadPlaceScope(page.actor.userId);
  const districtRows = place.churchIds.size
    ? await page.db
        .select({ district: mapChurches.district })
        .from(mapChurches)
        .where(inArray(mapChurches.id, [...place.churchIds]))
    : [];
  const districts = new Set(districtRows.flatMap((row) => (row.district ? [row.district] : [])));
  const visible = filterVisiblePrayers(page.actor, records).filter(
    (row) =>
      row.memberId === page.membership.memberId ||
      canSeePrayerScope({
        scope: row.scope,
        churchId: row.churchId,
        groupId: row.groupId,
        churchIds: place.churchIds,
        groupIds: place.groupIds,
        districts,
      }),
  );
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
        scopeLabel: prayerScopeLabel(row.scope, dto.visibility),
        prayTogetherCount: dto.prayTogetherCount,
        authorName: dto.authorMemberId ? row.authorName : null,
        alreadyPrayed: reactedIds.has(dto.id),
      };
    }),
  };
}

export async function createPrayer(input: {
  content: string;
  scope: PrayerScope;
  isAnonymous: boolean;
}): Promise<string> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = await requireMember(actor, communityId);
  if (!isPrayerScope(input.scope)) throw new PrayerFlowError("기도 범위를 골라 주세요.");
  const placed = await prayerPlacement(actor, membership.currentGroupId, input.scope);
  assertCan(actor, {
    type: "write_prayer",
    communityId,
    visibility: placed.visibility,
    groupId: placed.groupId,
  });
  await assertTextsAllowed(input.content);
  const db = getDb();
  const [created] = await db
    .insert(prayerRequests)
    .values({
      communityId,
      memberId: membership.memberId,
      groupId: placed.groupId,
      churchId: placed.churchId,
      content: input.content.trim(),
      isAnonymous: input.isAnonymous,
      visibility: placed.visibility,
      scope: input.scope,
    })
    .returning({ id: prayerRequests.id });
  if (!created) throw new PrayerFlowError("기도를 저장하지 못했습니다.");
  return created.id;
}

async function prayerPlacement(
  actor: Actor,
  currentGroupId: string | null,
  scope: PrayerScope,
): Promise<{ visibility: PrayerVisibility; groupId: string | null; churchId: string | null }> {
  if (scope === "gathering") {
    if (!currentGroupId) throw new PrayerFlowError("모들 범위로 쓰려면 속한 모들이 있어야 합니다.");
    return { visibility: "GROUP_ONLY", groupId: currentGroupId, churchId: null };
  }
  if (scope === "church") {
    const churchId = actor.kind === "user" ? await currentChurchIdFor(actor.userId) : null;
    if (!churchId) throw new PrayerFlowError("교회 범위로 쓰려면 내가 갈 교회가 있어야 합니다.");
    return { visibility: "PUBLIC", groupId: null, churchId };
  }
  return { visibility: "PUBLIC", groupId: null, churchId: null };
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
  await assertTextsAllowed(input.message);
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
