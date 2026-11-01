/**
 * 기도 글을 저장하고, 역할과 모들로 거른 뒤 화면에 내려 줍니다.
 * 익명이면 작성자가 아닌 응답에서 작성자 정보를 뺍니다.
 * 권한은 assertCan 과 visiblePrayerFilter, toPrayerDto 만 씁니다.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { letterRecipientLabel, nextPrayTogetherCount } from "@/prayer/rules";
import { canSeePrayerScope, isPrayerScope, prayerScopeKey, prayerScopeLabel, type PrayerScope } from "@/prayer/scopes";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { filterVisiblePrayers, toPrayerDto, type PrayerRecord } from "@/server/auth/prayer-visibility";
import { assertApprovedMember, assertCan, assertSameCommunity, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, mapChurches, members, prayerLetters, prayerReactions, prayerRequests, smallGroups } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";
import { loadPlaceScope } from "@/server/place/service";

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
  const churchRows = place.churchIds.size
    ? await page.db.select({ id: mapChurches.id, name: mapChurches.name }).from(mapChurches).where(inArray(mapChurches.id, [...place.churchIds]))
    : [];
  const groupRows = place.groupIds.size
    ? await page.db.select({ id: smallGroups.id, name: smallGroups.name }).from(smallGroups).where(inArray(smallGroups.id, [...place.groupIds]))
    : [];
  return {
    ok: true as const,
    communityName: page.communityName,
    churches: churchRows.slice().sort((left, right) => left.name.localeCompare(right.name, "ko")),
    gatherings: groupRows.slice().sort((left, right) => left.name.localeCompare(right.name, "ko")),
    items: visible.map((row) => {
      const dto = toPrayerDto(row, page.actor);
      return {
        id: dto.id,
        content: dto.content,
        isAnonymous: dto.isAnonymous,
        visibility: dto.visibility,
        scopeLabel: prayerScopeLabel(row.scope, dto.visibility),
        scopeKey: prayerScopeKey({ scope: row.scope, churchId: row.churchId, groupId: row.groupId }),
        prayTogetherCount: dto.prayTogetherCount,
        authorName: dto.authorMemberId ? row.authorName : null,
        alreadyPrayed: reactedIds.has(dto.id),
      };
    }),
  };
}

export async function createPrayer(input: {
  content: string;
  placeRefs: readonly string[];
  isAnonymous: boolean;
}): Promise<string> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = await requireMember(actor, communityId);
  if (actor.kind !== "user") throw new PrayerFlowError("기도를 쓰려면 먼저 들어가 주세요.");
  const followed = await loadPlaceScope(actor.userId);
  const targets = prayerTargets(input.placeRefs, followed.churchIds, followed.groupIds);
  if (targets.length === 0) throw new PrayerFlowError("기도 범위를 골라 주세요.");
  await assertTextsAllowed(input.content);
  const db = getDb();
  let firstId = "";
  for (const target of targets) {
    assertCan(actor, {
      type: "write_prayer",
      communityId,
      visibility: "PUBLIC",
      groupId: target.groupId,
    });
    const [created] = await db
      .insert(prayerRequests)
      .values({
        communityId,
        memberId: membership.memberId,
        groupId: target.groupId,
        churchId: target.churchId,
        content: input.content.trim(),
        isAnonymous: input.isAnonymous,
        visibility: "PUBLIC",
        scope: target.scope,
      })
      .returning({ id: prayerRequests.id });
    if (!created) throw new PrayerFlowError("기도를 저장하지 못했습니다.");
    if (!firstId) firstId = created.id;
  }
  return firstId;
}

function prayerTargets(
  placeRefs: readonly string[],
  churchIds: ReadonlySet<string>,
  groupIds: ReadonlySet<string>,
): Array<{ scope: PrayerScope; churchId: string | null; groupId: string | null }> {
  const targets: Array<{ scope: PrayerScope; churchId: string | null; groupId: string | null }> = [];
  let broad = false;
  let place = false;
  for (const ref of placeRefs) {
    const splitAt = ref.indexOf(":");
    const kind = splitAt > 0 ? ref.slice(0, splitAt) : ref;
    const id = splitAt > 0 ? ref.slice(splitAt + 1) : "";
    if (kind === "all" || kind === "jeju_city" || kind === "seogwipo") {
      broad = true;
      if (!targets.some((item) => item.scope === kind)) targets.push({ scope: kind, churchId: null, groupId: null });
      continue;
    }
    if (kind === "church" && id && churchIds.has(id)) {
      place = true;
      targets.push({ scope: "church", churchId: id, groupId: null });
      continue;
    }
    if (kind === "gathering" && id && groupIds.has(id)) {
      place = true;
      targets.push({ scope: "gathering", churchId: null, groupId: id });
    }
  }
  if (broad && place) throw new PrayerFlowError("전체나 지역과 교회·모들을 같이 고를 수 없습니다.");
  if (broad && targets.filter((item) => item.scope !== "church" && item.scope !== "gathering").length > 1) {
    throw new PrayerFlowError("전체, 제주시, 서귀포시 중 하나만 고를 수 있습니다.");
  }
  if (!isPrayerScope(targets[0]?.scope ?? "")) return [];
  return targets;
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
