/**
 * 교회 구독과 모임 구독, 태우리 수정 권한입니다.
 * 사용자 화면에는 공동체를 두지 않습니다.
 */

import { and, asc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { canAssignSteward, canEditShared, canSeeSharedRow, placeSlug, type PlaceKind } from "@/place/rules";
import { loadActor } from "@/server/auth/session";
import {
  churchFollows,
  communities,
  groupFollows,
  mapChurches,
  placeEditGrants,
  smallGroups,
  users,
} from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { lookupAddressPoint } from "@/server/map/address-lookup";
import { assertTextsAllowed } from "@/server/moderation/guard";

export class PlaceFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaceFlowError";
  }
}

export function readablePlaceError(error: unknown): string {
  if (error instanceof PlaceFlowError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "교회나 모들을 처리하지 못했습니다.";
}

async function requireUserId(): Promise<string> {
  const actor = await loadActor();
  if (actor.kind !== "user") throw new PlaceFlowError("먼저 들어가 주세요.");
  return actor.userId;
}

async function storageCommunityId(): Promise<string> {
  const db = getDb();
  const [named] = await db.select({ id: communities.id }).from(communities).where(eq(communities.slug, "modl")).limit(1);
  if (named) return named.id;
  const [any] = await db.select({ id: communities.id }).from(communities).limit(1);
  if (!any) throw new PlaceFlowError("모들을 아직 만들 수 없습니다.");
  return any.id;
}

export async function attachChurchToUser(userId: string, churchId: string, options: { created: boolean; makeCurrent: boolean }) {
  await ensureDatabase();
  const db = getDb();
  await db.insert(churchFollows).values({ userId, churchId }).onConflictDoNothing({
    target: [churchFollows.userId, churchFollows.churchId],
  });
  if (options.created) {
    await db
      .update(mapChurches)
      .set({ createdByUserId: userId, updatedAt: new Date() })
      .where(and(eq(mapChurches.id, churchId), isNull(mapChurches.createdByUserId)));
  }
  if (options.makeCurrent) {
    await db.update(users).set({ homeChurchId: churchId, updatedAt: new Date() }).where(eq(users.id, userId));
  }
}

export type PlaceScope = {
  userId: string;
  churchIds: Set<string>;
  groupIds: Set<string>;
  formalCommunityIds: Set<string>;
  editChurchIds: Set<string>;
  editGroupIds: Set<string>;
  currentChurchId: string | null;
  currentGroupId: string | null;
  isPastor: boolean;
};

export async function loadPlaceScope(userId: string): Promise<PlaceScope> {
  await ensureDatabase();
  const db = getDb();
  const [user] = await db
    .select({ homeChurchId: users.homeChurchId, currentGroupId: users.currentGroupId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.homeChurchId) {
    await db.insert(churchFollows).values({ userId, churchId: user.homeChurchId }).onConflictDoNothing({
      target: [churchFollows.userId, churchFollows.churchId],
    });
  }
  const churchRows = await db.select({ churchId: churchFollows.churchId }).from(churchFollows).where(eq(churchFollows.userId, userId));
  const groupRows = await db.select({ groupId: groupFollows.groupId }).from(groupFollows).where(eq(groupFollows.userId, userId));
  const churchIds = new Set(churchRows.map((row) => row.churchId));
  const groupIds = new Set(groupRows.map((row) => row.groupId));
  const actor = await loadActor();
  const formalCommunityIds = new Set<string>();
  let isPastor = false;
  if (actor.kind === "user" && actor.userId === userId) {
    for (const item of actor.memberships) {
      formalCommunityIds.add(item.communityId);
      if (item.role === "PASTOR") isPastor = true;
    }
  }
  const grants = await db.select().from(placeEditGrants).where(eq(placeEditGrants.userId, userId));
  const editChurchIds = new Set<string>();
  const editGroupIds = new Set<string>();
  const ownedChurches = churchIds.size
    ? await db
        .select({ id: mapChurches.id, createdByUserId: mapChurches.createdByUserId })
        .from(mapChurches)
        .where(inArray(mapChurches.id, [...churchIds]))
    : [];
  const ownedGroups = groupIds.size
    ? await db
        .select({ id: smallGroups.id, createdByUserId: smallGroups.createdByUserId })
        .from(smallGroups)
        .where(inArray(smallGroups.id, [...groupIds]))
    : [];
  for (const row of ownedChurches) {
    if (canEditShared({ isSteward: row.createdByUserId === userId, granted: grants.some((grant) => grant.churchId === row.id) })) {
      editChurchIds.add(row.id);
    }
  }
  for (const row of ownedGroups) {
    if (canEditShared({ isSteward: row.createdByUserId === userId, granted: grants.some((grant) => grant.groupId === row.id) })) {
      editGroupIds.add(row.id);
    }
  }
  return {
    userId,
    churchIds,
    groupIds,
    formalCommunityIds,
    editChurchIds,
    editGroupIds,
    currentChurchId: user?.homeChurchId && churchIds.has(user.homeChurchId) ? user.homeChurchId : null,
    currentGroupId: user?.currentGroupId && groupIds.has(user.currentGroupId) ? user.currentGroupId : null,
    isPastor,
  };
}

export function visibleSharedRows<T extends { churchId: string | null; groupId: string | null; communityId: string }>(
  rows: readonly T[],
  scope: PlaceScope,
): T[] {
  return rows.filter((row) => canSeeSharedRow(row, scope.churchIds, scope.groupIds, scope.formalCommunityIds));
}

export async function currentChurchIdFor(userId: string): Promise<string | null> {
  const scope = await loadPlaceScope(userId);
  return scope.currentChurchId;
}

async function churchCommunity(churchId: string): Promise<string> {
  const [row] = await getDb().select({ communityId: mapChurches.communityId }).from(mapChurches).where(eq(mapChurches.id, churchId)).limit(1);
  if (!row) throw new PlaceFlowError("교회를 찾지 못했습니다.");
  return row.communityId;
}

async function groupCommunity(groupId: string): Promise<string> {
  const [row] = await getDb().select({ communityId: smallGroups.communityId }).from(smallGroups).where(eq(smallGroups.id, groupId)).limit(1);
  if (!row) throw new PlaceFlowError("모들을 찾지 못했습니다.");
  return row.communityId;
}

export async function placeCommunity(kind: PlaceKind, id: string): Promise<string> {
  return kind === "church" ? churchCommunity(id) : groupCommunity(id);
}

export async function ensurePlaceSlug(kind: PlaceKind, id: string): Promise<string> {
  await ensureDatabase();
  const db = getDb();
  const slug = placeSlug(kind, id);
  if (kind === "church") {
    const [row] = await db.select({ slug: mapChurches.slug }).from(mapChurches).where(eq(mapChurches.id, id)).limit(1);
    if (!row) throw new PlaceFlowError("교회를 찾지 못했습니다.");
    if (row.slug) return row.slug;
    await db.update(mapChurches).set({ slug, updatedAt: new Date() }).where(eq(mapChurches.id, id));
    return slug;
  }
  const [row] = await db.select({ slug: smallGroups.slug }).from(smallGroups).where(eq(smallGroups.id, id)).limit(1);
  if (!row) throw new PlaceFlowError("모들을 찾지 못했습니다.");
  if (row.slug) return row.slug;
  await db.update(smallGroups).set({ slug, updatedAt: new Date() }).where(eq(smallGroups.id, id));
  return slug;
}

export async function subscribeChurch(churchId: string) {
  const userId = await requireUserId();
  await ensureDatabase();
  const [church] = await getDb().select({ id: mapChurches.id }).from(mapChurches).where(eq(mapChurches.id, churchId)).limit(1);
  if (!church) throw new PlaceFlowError("교회를 찾지 못했습니다.");
  await attachChurchToUser(userId, churchId, { created: false, makeCurrent: false });
}

export async function setCurrentChurch(churchId: string) {
  const userId = await requireUserId();
  const scope = await loadPlaceScope(userId);
  if (!scope.churchIds.has(churchId)) throw new PlaceFlowError("구독한 교회만 내가 갈 교회로 고를 수 있습니다.");
  await getDb().update(users).set({ homeChurchId: churchId, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function unsubscribeChurch(churchId: string) {
  const userId = await requireUserId();
  const db = getDb();
  await db.delete(churchFollows).where(and(eq(churchFollows.userId, userId), eq(churchFollows.churchId, churchId)));
  await db.delete(placeEditGrants).where(and(eq(placeEditGrants.userId, userId), eq(placeEditGrants.churchId, churchId)));
  const [user] = await db.select({ homeChurchId: users.homeChurchId }).from(users).where(eq(users.id, userId)).limit(1);
  if (user?.homeChurchId === churchId) {
    await db.update(users).set({ homeChurchId: null, updatedAt: new Date() }).where(eq(users.id, userId));
  }
}

export async function createGathering(input: { name: string; address: string }) {
  const userId = await requireUserId();
  await ensureDatabase();
  const name = input.name.trim();
  const address = input.address.trim();
  if (!name) throw new PlaceFlowError("모들 이름을 적어 주세요.");
  await assertTextsAllowed(name, address);
  const point = address ? await lookupAddressPoint(address) : null;
  if (address && !point) throw new PlaceFlowError("이 주소를 지도에서 찾지 못했습니다.");
  const db = getDb();
  const [created] = await db
    .insert(smallGroups)
    .values({
      communityId: await storageCommunityId(),
      seasonYear: new Date().getFullYear(),
      name,
      address,
      lat: point?.lat ?? null,
      lon: point?.lon ?? null,
      createdByUserId: userId,
    })
    .returning({ id: smallGroups.id });
  if (!created) throw new PlaceFlowError("모들을 만들지 못했습니다.");
  await db.insert(groupFollows).values({ userId, groupId: created.id }).onConflictDoNothing({
    target: [groupFollows.userId, groupFollows.groupId],
  });
  await db.update(users).set({ currentGroupId: created.id, updatedAt: new Date() }).where(eq(users.id, userId));
  await ensurePlaceSlug("gathering", created.id);
}

export async function subscribeGathering(groupId: string) {
  const userId = await requireUserId();
  await ensureDatabase();
  const [group] = await getDb().select({ id: smallGroups.id }).from(smallGroups).where(eq(smallGroups.id, groupId)).limit(1);
  if (!group) throw new PlaceFlowError("모들을 찾지 못했습니다.");
  await getDb().insert(groupFollows).values({ userId, groupId }).onConflictDoNothing({
    target: [groupFollows.userId, groupFollows.groupId],
  });
}

export async function setCurrentGathering(groupId: string) {
  const userId = await requireUserId();
  const scope = await loadPlaceScope(userId);
  if (!scope.groupIds.has(groupId)) throw new PlaceFlowError("구독한 모들만 내가 갈 모들로 둘 수 있습니다.");
  await getDb().update(users).set({ currentGroupId: groupId, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function unsubscribeGathering(groupId: string) {
  const userId = await requireUserId();
  const db = getDb();
  await db.delete(groupFollows).where(and(eq(groupFollows.userId, userId), eq(groupFollows.groupId, groupId)));
  await db.delete(placeEditGrants).where(and(eq(placeEditGrants.userId, userId), eq(placeEditGrants.groupId, groupId)));
  const [user] = await db.select({ currentGroupId: users.currentGroupId }).from(users).where(eq(users.id, userId)).limit(1);
  if (user?.currentGroupId === groupId) {
    await db.update(users).set({ currentGroupId: null, updatedAt: new Date() }).where(eq(users.id, userId));
  }
}

async function assertSteward(userId: string, kind: PlaceKind, id: string) {
  if (kind === "church") {
    const [row] = await getDb().select({ createdByUserId: mapChurches.createdByUserId }).from(mapChurches).where(eq(mapChurches.id, id)).limit(1);
    if (row?.createdByUserId !== userId) throw new PlaceFlowError("모들장만 수정 권한을 줄 수 있습니다.");
    return;
  }
  const [row] = await getDb().select({ createdByUserId: smallGroups.createdByUserId }).from(smallGroups).where(eq(smallGroups.id, id)).limit(1);
  if (row?.createdByUserId !== userId) throw new PlaceFlowError("모들장만 수정 권한을 줄 수 있습니다.");
}

export async function grantPlaceEdit(kind: PlaceKind, placeId: string, memberUserId: string) {
  const userId = await requireUserId();
  await ensureDatabase();
  await assertSteward(userId, kind, placeId);
  const db = getDb();
  if (kind === "church") {
    const [follow] = await db
      .select({ id: churchFollows.id })
      .from(churchFollows)
      .where(and(eq(churchFollows.userId, memberUserId), eq(churchFollows.churchId, placeId)))
      .limit(1);
    if (!follow) throw new PlaceFlowError("그 교회에 속한 사람에게만 수정 권한을 줄 수 있습니다.");
    const [existing] = await db
      .select({ id: placeEditGrants.id })
      .from(placeEditGrants)
      .where(and(eq(placeEditGrants.userId, memberUserId), eq(placeEditGrants.churchId, placeId)))
      .limit(1);
    if (!existing) await db.insert(placeEditGrants).values({ userId: memberUserId, churchId: placeId, grantedByUserId: userId });
    return;
  }
  const [follow] = await db
    .select({ id: groupFollows.id })
    .from(groupFollows)
    .where(and(eq(groupFollows.userId, memberUserId), eq(groupFollows.groupId, placeId)))
    .limit(1);
  if (!follow) throw new PlaceFlowError("그 모들에 속한 사람에게만 수정 권한을 줄 수 있습니다.");
  const [existing] = await db
    .select({ id: placeEditGrants.id })
    .from(placeEditGrants)
    .where(and(eq(placeEditGrants.userId, memberUserId), eq(placeEditGrants.groupId, placeId)))
    .limit(1);
  if (!existing) await db.insert(placeEditGrants).values({ userId: memberUserId, groupId: placeId, grantedByUserId: userId });
}

export async function revokePlaceEdit(grantId: string) {
  const userId = await requireUserId();
  await ensureDatabase();
  const db = getDb();
  const [grant] = await db.select().from(placeEditGrants).where(eq(placeEditGrants.id, grantId)).limit(1);
  if (!grant) throw new PlaceFlowError("수정 권한을 찾지 못했습니다.");
  if (grant.churchId) await assertSteward(userId, "church", grant.churchId);
  if (grant.groupId) await assertSteward(userId, "gathering", grant.groupId);
  await db.delete(placeEditGrants).where(eq(placeEditGrants.id, grantId));
}

export async function assignSteward(kind: PlaceKind, placeId: string, email: string) {
  const userId = await requireUserId();
  const scope = await loadPlaceScope(userId);
  await ensureDatabase();
  const db = getDb();
  const [person] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!person) throw new PlaceFlowError("그 이메일의 계정을 찾지 못했습니다.");
  if (kind === "church") {
    const [row] = await db.select({ createdByUserId: mapChurches.createdByUserId }).from(mapChurches).where(eq(mapChurches.id, placeId)).limit(1);
    if (!row) throw new PlaceFlowError("교회를 찾지 못했습니다.");
    if (!canAssignSteward({ hasSteward: Boolean(row.createdByUserId), isPastor: scope.isPastor })) {
      throw new PlaceFlowError("만든 사람이 없는 교회만 사역자가 모들장을 지정합니다.");
    }
    await db.update(mapChurches).set({ createdByUserId: person.id, updatedAt: new Date() }).where(eq(mapChurches.id, placeId));
    await db.insert(churchFollows).values({ userId: person.id, churchId: placeId }).onConflictDoNothing({
      target: [churchFollows.userId, churchFollows.churchId],
    });
    return;
  }
  const [row] = await db.select({ createdByUserId: smallGroups.createdByUserId }).from(smallGroups).where(eq(smallGroups.id, placeId)).limit(1);
  if (!row) throw new PlaceFlowError("모들을 찾지 못했습니다.");
  if (!canAssignSteward({ hasSteward: Boolean(row.createdByUserId), isPastor: scope.isPastor })) {
    throw new PlaceFlowError("만든 사람이 없는 모들만 사역자가 모들장을 지정합니다.");
  }
  await db.update(smallGroups).set({ createdByUserId: person.id, updatedAt: new Date() }).where(eq(smallGroups.id, placeId));
  await db.insert(groupFollows).values({ userId: person.id, groupId: placeId }).onConflictDoNothing({
    target: [groupFollows.userId, groupFollows.groupId],
  });
}

export type PlaceAccount = {
  churches: Array<{ id: string; name: string; current: boolean; steward: boolean }>;
  gatherings: Array<{ id: string; name: string; current: boolean; steward: boolean }>;
  foundChurches: Array<{ id: string; name: string; subscribed: boolean }>;
  foundGatherings: Array<{ id: string; name: string; subscribed: boolean }>;
  grants: Array<{ id: string; name: string; person: string; kind: PlaceKind }>;
  members: Array<{ userId: string; name: string; placeId: string; kind: PlaceKind; placeName: string }>;
  unassigned: Array<{ id: string; name: string; kind: PlaceKind }>;
  isPastor: boolean;
};

export async function loadPlaceAccount(churchQuery: string, gatheringQuery: string): Promise<PlaceAccount | null> {
  const actor = await loadActor();
  if (actor.kind !== "user") return null;
  const scope = await loadPlaceScope(actor.userId);
  const db = getDb();
  const churches = scope.churchIds.size
    ? await db
        .select({ id: mapChurches.id, name: mapChurches.name, createdByUserId: mapChurches.createdByUserId })
        .from(mapChurches)
        .where(inArray(mapChurches.id, [...scope.churchIds]))
        .orderBy(asc(mapChurches.name))
    : [];
  const gatherings = scope.groupIds.size
    ? await db
        .select({ id: smallGroups.id, name: smallGroups.name, createdByUserId: smallGroups.createdByUserId })
        .from(smallGroups)
        .where(inArray(smallGroups.id, [...scope.groupIds]))
        .orderBy(asc(smallGroups.name))
    : [];
  const churchNeedle = churchQuery.trim();
  const gatheringNeedle = gatheringQuery.trim();
  const foundChurches = churchNeedle
    ? await db
        .select({ id: mapChurches.id, name: mapChurches.name })
        .from(mapChurches)
        .where(ilike(mapChurches.name, `%${churchNeedle.replace(/[%_]/g, "")}%`))
        .orderBy(asc(mapChurches.name))
        .limit(20)
    : [];
  const foundGatherings = gatheringNeedle
    ? await db
        .select({ id: smallGroups.id, name: smallGroups.name })
        .from(smallGroups)
        .where(and(eq(smallGroups.isArchived, false), ilike(smallGroups.name, `%${gatheringNeedle.replace(/[%_]/g, "")}%`)))
        .orderBy(asc(smallGroups.name))
        .limit(20)
    : [];
  const stewardChurchIds = churches.filter((row) => row.createdByUserId === actor.userId).map((row) => row.id);
  const stewardGroupIds = gatherings.filter((row) => row.createdByUserId === actor.userId).map((row) => row.id);
  const grantRows = await db.select().from(placeEditGrants);
  const mineGrants = grantRows.filter(
    (row) => (row.churchId && stewardChurchIds.includes(row.churchId)) || (row.groupId && stewardGroupIds.includes(row.groupId)),
  );
  const peopleIds = [...new Set(mineGrants.map((row) => row.userId))];
  const people = peopleIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, peopleIds))
    : [];
  const names = new Map(people.map((row) => [row.id, row.name]));
  const churchNames = new Map(churches.map((row) => [row.id, row.name]));
  const groupNames = new Map(gatherings.map((row) => [row.id, row.name]));
  const followChurchRows = stewardChurchIds.length
    ? await db
        .select({ userId: churchFollows.userId, churchId: churchFollows.churchId, name: users.name })
        .from(churchFollows)
        .innerJoin(users, eq(users.id, churchFollows.userId))
        .where(inArray(churchFollows.churchId, stewardChurchIds))
    : [];
  const followGroupRows = stewardGroupIds.length
    ? await db
        .select({ userId: groupFollows.userId, groupId: groupFollows.groupId, name: users.name })
        .from(groupFollows)
        .innerJoin(users, eq(users.id, groupFollows.userId))
        .where(inArray(groupFollows.groupId, stewardGroupIds))
    : [];
  let unassigned: PlaceAccount["unassigned"] = [];
  if (scope.isPastor && churchNeedle) {
    const rows = await db
      .select({ id: mapChurches.id, name: mapChurches.name })
      .from(mapChurches)
      .where(and(isNull(mapChurches.createdByUserId), ilike(mapChurches.name, `%${churchNeedle.replace(/[%_]/g, "")}%`)))
      .orderBy(asc(mapChurches.name))
      .limit(20);
    unassigned = rows.map((row) => ({ id: row.id, name: row.name, kind: "church" as const }));
  }
  return {
    churches: churches.map((row) => ({
      id: row.id,
      name: row.name,
      current: row.id === scope.currentChurchId,
      steward: row.createdByUserId === actor.userId,
    })),
    gatherings: gatherings.map((row) => ({
      id: row.id,
      name: row.name,
      current: row.id === scope.currentGroupId,
      steward: row.createdByUserId === actor.userId,
    })),
    foundChurches: foundChurches.map((row) => ({ ...row, subscribed: scope.churchIds.has(row.id) })),
    foundGatherings: foundGatherings.map((row) => ({ ...row, subscribed: scope.groupIds.has(row.id) })),
    grants: mineGrants.map((row) => ({
      id: row.id,
      name: (row.churchId ? churchNames.get(row.churchId) : row.groupId ? groupNames.get(row.groupId) : "") ?? "",
      person: names.get(row.userId) ?? "",
      kind: row.churchId ? "church" : "gathering",
    })),
    members: [
      ...followChurchRows
        .filter((row) => row.userId !== actor.userId)
        .map((row) => ({
          userId: row.userId,
          name: row.name,
          placeId: row.churchId,
          kind: "church" as const,
          placeName: churchNames.get(row.churchId) ?? "",
        })),
      ...followGroupRows
        .filter((row) => row.userId !== actor.userId)
        .map((row) => ({
          userId: row.userId,
          name: row.name,
          placeId: row.groupId,
          kind: "gathering" as const,
          placeName: groupNames.get(row.groupId) ?? "",
        })),
    ],
    unassigned,
    isPastor: scope.isPastor,
  };
}
