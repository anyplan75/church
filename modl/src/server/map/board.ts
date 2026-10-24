/**
 * 공동체 교회와 데리러 가기 핀을 읽고 저장합니다.
 * 좌표는 주소 검색 결과만 쓰고, 없는 좌표는 만들지 않습니다.
 * 교회를 넣고 고치고 지우는 일은 사역자만 합니다.
 */

import { and, eq } from "drizzle-orm";
import { showsCommunitySettings } from "@/account/access";
import { canSeePickupPin } from "@/map/access";
import { type ChurchInput, type ChurchPin, type ChurchRecord, parseChurchRows } from "@/map/church-sheet";
import { normalizeChurchTags, type ChurchTag } from "@/map/church-tags";
import { openingFocus, type MapOpeningSource } from "@/map/opening";
import { cityFromStored, regionFromAddress } from "@/map/region";
import type { MapPoint } from "@/map/rules";
import { formalMembership } from "@/server/auth/membership";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { CHURCH_PIN_COLOR, GATHERING_PIN_COLOR } from "@/place/rules";
import { communities, mapChurches, members, promoPages, smallGroups, users } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { lookupAddressPoint } from "@/server/map/address-lookup";
import { loadPlaceScope } from "@/server/place/service";
import { geocodeAddress } from "@/server/map/mapbox";
import { MapServiceError } from "@/server/map/service";
import { assertTextsAllowed } from "@/server/moderation/guard";

export type MapSelf = {
  address: string;
  consented: boolean;
};

export type GatheringPin = {
  id: string;
  name: string;
  address: string;
  point: MapPoint;
};

export type MapBoardData = {
  churches: ChurchPin[];
  gatherings: GatheringPin[];
  directoryChurches: Array<{ id: string; name: string; address: string }>;
  directoryGatherings: Array<{ id: string; name: string; address: string }>;
  churchPinColor: string;
  gatheringPinColor: string;
  pickups: Array<{ id: string; name: string; point: MapPoint }>;
  self: MapSelf | null;
  hasChurches: boolean;
  /** 계정 교회 목록을 고칠 수 있는 사역자만 참입니다. */
  canEditChurches: boolean;
  signedIn: boolean;
  followedChurchIds: string[];
  followedGroupIds: string[];
  openingPoint: MapPoint;
  openingSource: MapOpeningSource;
};

export type SavedChurch = {
  id: string;
  name: string;
  pastorName: string;
  address: string;
  phone: string;
  serviceTime: string;
  memo: string;
  region: "제주시" | "서귀포시" | null;
  tags: ChurchTag[];
  point: MapPoint | null;
};

export type ChurchSettings = {
  ok: true;
  churches: ChurchRecord[];
} | {
  ok: false;
  message: string;
};

async function viewer() {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId || actor.kind !== "user") return null;
  const membership = formalMembership(actor, communityId);
  if (!membership) return null;
  return { actor, communityId, membership };
}

async function pastor() {
  const seen = await viewer();
  if (!seen || seen.membership.role !== "PASTOR") {
    throw new MapServiceError("교회 목록은 사역자만 고칩니다.");
  }
  return seen;
}

function finitePoint(lat: number | null, lon: number | null): MapPoint | null {
  if (lat === null || lon === null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function cleanChurch(input: ChurchInput): ChurchInput {
  const church = {
    name: input.name.trim(),
    pastorName: input.pastorName.trim(),
    address: input.address.trim(),
    phone: input.phone.trim(),
    serviceTime: input.serviceTime.trim(),
    memo: input.memo.trim(),
  };
  if (!church.name) throw new MapServiceError("교회 이름을 적어 주세요.");
  if (church.name.length > 80 || church.pastorName.length > 80 || church.phone.length > 40 || church.serviceTime.length > 80) {
    throw new MapServiceError("교회 이름, 목사, 전화번호, 예배 시간은 짧게 적어 주세요.");
  }
  if (church.address.length > 200 || church.memo.length > 500) {
    throw new MapServiceError("주소는 200자, 메모는 500자 안으로 적어 주세요.");
  }
  return church;
}

async function pointFor(address: string, previous: { address: string; lat: number | null; lon: number | null } | null): Promise<{
  point: MapPoint | null;
  missed: boolean;
}> {
  if (!address) return { point: null, missed: false };
  const found = await geocodeAddress(address);
  if (found) return { point: found, missed: false };
  if (previous && previous.address === address) {
    const kept = finitePoint(previous.lat, previous.lon);
    if (kept) return { point: kept, missed: false };
  }
  return { point: null, missed: true };
}

function movedPoint(left: MapPoint, right: MapPoint): boolean {
  return Math.abs(left.lat - right.lat) > 0.0002 || Math.abs(left.lon - right.lon) > 0.0002;
}

/** 저장된 주소의 좌표입니다. 다른 장소의 검색 결과는 쓰지 않습니다. */
async function pointForSavedAddress(address: string, stored: MapPoint | null): Promise<MapPoint | null> {
  const text = address.trim();
  if (!text) return stored;
  try {
    return await lookupAddressPoint(text);
  } catch {
    return stored;
  }
}

async function operatorCommunityId(): Promise<string | null> {
  const rows = await getDb().select({ id: communities.id }).from(communities).where(eq(communities.slug, "modl")).limit(1);
  return rows[0]?.id ?? null;
}

async function followState(): Promise<Pick<MapBoardData, "signedIn" | "followedChurchIds" | "followedGroupIds">> {
  const actor = await loadActor();
  if (actor.kind !== "user") return { signedIn: false, followedChurchIds: [], followedGroupIds: [] };
  const scope = await loadPlaceScope(actor.userId);
  return { signedIn: true, followedChurchIds: [...scope.churchIds], followedGroupIds: [...scope.groupIds] };
}

export async function loadMapBoard(): Promise<MapBoardData> {
  const follows = await followState();
  const seen = await viewer();
  const communityId = seen?.communityId ?? (await operatorCommunityId());
  if (!communityId) {
    const opening = openingFocus({});
    return {
      churches: [],
      gatherings: [],
      directoryChurches: [],
      directoryGatherings: [],
      churchPinColor: CHURCH_PIN_COLOR,
      gatheringPinColor: GATHERING_PIN_COLOR,
      pickups: [],
      self: null,
      hasChurches: false,
      canEditChurches: false,
      openingPoint: opening.point,
      openingSource: opening.source,
      ...follows,
    };
  }
  const db = getDb();
  const churchRows = await db.select().from(mapChurches).where(eq(mapChurches.communityId, communityId));
  const memberRows = seen
    ? await db
        .select({
          id: members.id,
          userId: members.userId,
          name: members.name,
          address: members.address,
          pickupConsentAt: members.pickupConsentAt,
          pickupLat: members.pickupLat,
          pickupLon: members.pickupLon,
        })
        .from(members)
        .where(eq(members.communityId, seen.communityId))
    : [];
  const promoRows = await db.select({ churchId: promoPages.churchId, intro: promoPages.intro }).from(promoPages);
  const introByChurch = new Map(promoRows.flatMap((row) => (row.churchId ? [[row.churchId, row.intro] as const] : [])));
  const mapActor = await loadActor();
  const viewerId = mapActor.kind === "user" ? mapActor.userId : null;
  const churches = churchRows.flatMap((row) => {
    if (!row.address.trim()) return [];
    const point = finitePoint(row.lat, row.lon);
    if (!point) return [];
    return [
      {
        id: row.id,
        name: row.name,
        pastorName: row.pastorName,
        address: row.address,
        phone: row.phone,
        serviceTime: row.serviceTime,
        memo: row.memo,
        point,
        region: cityFromStored(row.sido, row.district, row.regionId),
        tags: normalizeChurchTags(row.tags),
        hasManager: Boolean(row.createdByUserId),
        promoIntro: introByChurch.get(row.id) ?? "",
        canEditIntro: Boolean(viewerId && row.createdByUserId === viewerId),
      },
    ];
  });
  const groupRows = await db
    .select({
      id: smallGroups.id,
      name: smallGroups.name,
      address: smallGroups.address,
      lat: smallGroups.lat,
      lon: smallGroups.lon,
    })
    .from(smallGroups)
    .where(eq(smallGroups.isArchived, false));
  const gatherings = groupRows.flatMap((row) => {
    const point = finitePoint(row.lat, row.lon);
    if (!point) return [];
    return [{ id: row.id, name: row.name, address: row.address, point }];
  });
  const pickups: MapBoardData["pickups"] = [];
  for (const row of memberRows) {
    if (!row.pickupConsentAt || !seen) continue;
    const stored = finitePoint(row.pickupLat, row.pickupLon);
    const point = (await pointForSavedAddress(row.address ?? "", stored)) ?? stored;
    if (!point) continue;
    if (row.address && (!stored || movedPoint(stored, point))) {
      await db
        .update(members)
        .set({ pickupLat: point.lat, pickupLon: point.lon, updatedAt: new Date() })
        .where(and(eq(members.id, row.id), eq(members.communityId, seen.communityId)));
    }
    if (
      !canSeePickupPin({
        viewerUserId: seen.actor.userId,
        viewerRole: seen.membership.role,
        pinUserId: row.userId,
      })
    ) {
      continue;
    }
    pickups.push({ id: row.id, name: row.name, point });
  }
  const mine = seen ? memberRows.find((row) => row.id === seen.membership.memberId) ?? null : null;
  const opening = await openingFor(mapActor.kind === "user" ? mapActor.userId : null, mine, churchRows);
  return {
    churches,
    gatherings,
    directoryChurches: churchRows
      .filter((row) => row.name.trim())
      .map((row) => ({ id: row.id, name: row.name, address: row.address })),
    directoryGatherings: groupRows
      .filter((row) => row.name.trim())
      .map((row) => ({ id: row.id, name: row.name, address: row.address })),
    churchPinColor: CHURCH_PIN_COLOR,
    gatheringPinColor: GATHERING_PIN_COLOR,
    pickups,
    self: mine ? { address: mine.address ?? "", consented: mine.pickupConsentAt !== null } : null,
    hasChurches: churchRows.length > 0,
    canEditChurches: Boolean(seen && showsCommunitySettings(seen.membership.role)),
    openingPoint: opening.point,
    openingSource: opening.source,
    ...follows,
  };
}

async function openingFor(
  userId: string | null,
  mine: { address: string | null; pickupLat: number | null; pickupLon: number | null } | null,
  churchRows: readonly { id: string; lat: number | null; lon: number | null }[],
) {
  if (!userId) return openingFocus({});
  const db = getDb();
  const [user] = await db.select({ homeChurchId: users.homeChurchId }).from(users).where(eq(users.id, userId)).limit(1);
  const homeRow = user?.homeChurchId ? churchRows.find((row) => row.id === user.homeChurchId) : undefined;
  let homeChurchPoint = homeRow ? finitePoint(homeRow.lat, homeRow.lon) : null;
  if (user?.homeChurchId && !homeChurchPoint) {
    const [home] = await db.select({ lat: mapChurches.lat, lon: mapChurches.lon }).from(mapChurches).where(eq(mapChurches.id, user.homeChurchId)).limit(1);
    homeChurchPoint = home ? finitePoint(home.lat, home.lon) : null;
  }
  let addressText = mine?.address?.trim() ?? "";
  let stored = mine ? finitePoint(mine.pickupLat, mine.pickupLon) : null;
  if (!addressText) {
    const [member] = await db
      .select({ address: members.address, pickupLat: members.pickupLat, pickupLon: members.pickupLon })
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1);
    addressText = member?.address?.trim() ?? "";
    stored = member ? finitePoint(member.pickupLat, member.pickupLon) : null;
  }
  const addressPoint = addressText ? (stored ?? (await pointForSavedAddress(addressText, null))) : null;
  return openingFocus({ addressPoint, addressText, homeChurchPoint });
}

export async function loadChurchSettings(): Promise<ChurchSettings> {
  const seen = await viewer();
  if (!seen) return { ok: false, message: "교회 목록을 고치려면 사역자로 들어가 주세요." };
  if (seen.membership.role !== "PASTOR") return { ok: false, message: "교회 목록은 사역자만 고칩니다." };
  const rows = await getDb().select().from(mapChurches).where(eq(mapChurches.communityId, seen.communityId));
  return {
    ok: true,
    churches: rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        pastorName: row.pastorName,
        address: row.address,
        phone: row.phone,
        serviceTime: row.serviceTime,
        memo: row.memo,
        pinned: Boolean(row.address.trim() && finitePoint(row.lat, row.lon)),
        region: cityFromStored(row.sido, row.district, row.regionId),
        tags: normalizeChurchTags(row.tags),
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "ko")),
  };
}

function savedChurch(row: typeof mapChurches.$inferSelect): SavedChurch {
  return {
    id: row.id,
    name: row.name,
    pastorName: row.pastorName,
    address: row.address,
    phone: row.phone,
    serviceTime: row.serviceTime,
    memo: row.memo,
    region: cityFromStored(row.sido, row.district, row.regionId),
    tags: normalizeChurchTags(row.tags),
    point: finitePoint(row.lat, row.lon),
  };
}

async function writeChurch(
  communityId: string,
  church: ChurchInput,
  churchId: string | null,
  tags?: ChurchTag[],
): Promise<{ missed: boolean; id: string }> {
  await assertTextsAllowed(church.name, church.pastorName, church.address, church.phone, church.serviceTime, church.memo);
  const db = getDb();
  const byId = churchId
    ? (
        await db
          .select()
          .from(mapChurches)
          .where(and(eq(mapChurches.id, churchId), eq(mapChurches.communityId, communityId)))
          .limit(1)
      )[0]
    : undefined;
  if (churchId && !byId) throw new MapServiceError("교회를 찾지 못했습니다.");
  const existing =
    byId ??
    (
      await db
        .select()
        .from(mapChurches)
        .where(and(eq(mapChurches.communityId, communityId), eq(mapChurches.name, church.name)))
        .limit(1)
    )[0];
  const located = await pointFor(
    church.address,
    existing ? { address: existing.address, lat: existing.lat, lon: existing.lon } : null,
  );
  const region = regionFromAddress(church.address);
  const values = {
    name: church.name,
    pastorName: church.pastorName,
    address: church.address,
    phone: church.phone,
    serviceTime: church.serviceTime,
    memo: church.memo,
    lat: located.point?.lat ?? null,
    lon: located.point?.lon ?? null,
    sido: region?.sido ?? null,
    district: region?.district ?? null,
    regionId: region?.regionId ?? null,
    updatedAt: new Date(),
    ...(tags ? { tags } : {}),
  };
  if (existing) {
    await db.update(mapChurches).set(values).where(eq(mapChurches.id, existing.id));
    return { missed: located.missed, id: existing.id };
  }
  const inserted = await db.insert(mapChurches).values({ communityId, ...values }).returning({ id: mapChurches.id });
  const id = inserted[0]?.id;
  if (!id) throw new MapServiceError("교회를 저장하지 못했습니다.");
  return { missed: located.missed, id };
}

/** 가입 직후 화면입니다. 이미 교회를 정한 계정은 다시 이 화면으로 보내지 않습니다. */
export async function loadSignupChurchPage(): Promise<{ signedIn: boolean; alreadyChosen: boolean }> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") return { signedIn: false, alreadyChosen: false };
  const [row] = await getDb().select({ homeChurchId: users.homeChurchId }).from(users).where(eq(users.id, actor.userId)).limit(1);
  return { signedIn: true, alreadyChosen: Boolean(row?.homeChurchId) };
}

async function signupUserId(): Promise<string> {
  const actor = await loadActor();
  if (actor.kind !== "user") throw new MapServiceError("먼저 계정을 만들어 주세요.");
  return actor.userId;
}

async function rememberHomeChurch(userId: string, churchId: string): Promise<void> {
  await getDb().update(users).set({ homeChurchId: churchId, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** 다니는 교회를 그 자리에서 등록하고 계정에 붙입니다. 지역 필터와 등급은 받지 않습니다. */
export async function registerSignupChurch(input: ChurchInput & { tags?: readonly string[] }): Promise<void> {
  await ensureDatabase();
  const userId = await signupUserId();
  const communityId = await operatorCommunityId();
  if (!communityId) throw new MapServiceError("교회를 아직 등록할 수 없습니다.");
  const church = cleanChurch(input);
  const tags = normalizeChurchTags(input.tags ?? []);
  const [same] = await getDb()
    .select({ id: mapChurches.id })
    .from(mapChurches)
    .where(and(eq(mapChurches.communityId, communityId), eq(mapChurches.name, church.name)))
    .limit(1);
  if (same) {
    const { attachChurchToUser } = await import("@/server/place/service");
    await attachChurchToUser(userId, same.id, { created: false, makeCurrent: true });
    return;
  }
  const written = await insertSignupChurch(communityId, church, tags);
  const { attachChurchToUser } = await import("@/server/place/service");
  await attachChurchToUser(userId, written.id, { created: true, makeCurrent: true });
}

async function insertSignupChurch(communityId: string, church: ChurchInput, tags: ChurchTag[]): Promise<{ id: string }> {
  await assertTextsAllowed(church.name, church.pastorName, church.address, church.phone, church.serviceTime, church.memo, ...tags);
  let located: { point: { lat: number; lon: number } | null; missed: boolean } = { point: null, missed: Boolean(church.address) };
  try {
    located = await pointFor(church.address, null);
  } catch (error) {
    if (!(error instanceof MapServiceError) || !error.message.includes("열쇠")) throw error;
  }
  const region = regionFromAddress(church.address);
  const inserted = await getDb()
    .insert(mapChurches)
    .values({
      communityId,
      name: church.name,
      pastorName: church.pastorName,
      address: church.address,
      phone: church.phone,
      serviceTime: church.serviceTime,
      memo: church.memo,
      lat: located.point?.lat ?? null,
      lon: located.point?.lon ?? null,
      sido: region?.sido ?? null,
      district: region?.district ?? null,
      regionId: region?.regionId ?? null,
      tags,
      updatedAt: new Date(),
    })
    .returning({ id: mapChurches.id });
  const id = inserted[0]?.id;
  if (!id) throw new MapServiceError("교회를 저장하지 못했습니다.");
  return { id };
}

export async function saveChurch(
  input: ChurchInput & { churchId?: string | null; tags?: readonly string[] },
): Promise<{ missed: boolean; church: SavedChurch }> {
  const seen = await pastor();
  const church = cleanChurch(input);
  const tags = normalizeChurchTags(input.tags ?? []);
  const written = await writeChurch(seen.communityId, church, input.churchId?.trim() || null, tags);
  const rows = await getDb().select().from(mapChurches).where(eq(mapChurches.id, written.id)).limit(1);
  const row = rows[0];
  if (!row) throw new MapServiceError("교회를 찾지 못했습니다.");
  return { missed: written.missed, church: savedChurch(row) };
}

export async function removeChurch(churchId: string): Promise<void> {
  const seen = await pastor();
  await getDb()
    .delete(mapChurches)
    .where(and(eq(mapChurches.id, churchId), eq(mapChurches.communityId, seen.communityId)));
}

export async function importChurchRows(rows: readonly (readonly string[])[]): Promise<{ count: number; missed: number }> {
  const seen = await pastor();
  const parsed = parseChurchRows(rows);
  if (!parsed.ok) throw new MapServiceError(parsed.message);
  let missed = 0;
  for (const church of parsed.churches) {
    if ((await writeChurch(seen.communityId, church, null)).missed) missed += 1;
  }
  return { count: parsed.churches.length, missed };
}

export async function loadMyPickup(): Promise<{ address: string; consented: boolean } | null> {
  const seen = await viewer();
  if (!seen) return null;
  const rows = await getDb()
    .select({
      address: members.address,
      pickupConsentAt: members.pickupConsentAt,
    })
    .from(members)
    .where(and(eq(members.id, seen.membership.memberId), eq(members.communityId, seen.communityId)))
    .limit(1);
  const mine = rows[0];
  if (!mine) return null;
  return { address: mine.address ?? "", consented: mine.pickupConsentAt !== null };
}

export async function saveMyAddress(address: string): Promise<void> {
  const seen = await viewer();
  if (!seen) throw new MapServiceError("주소를 저장하려면 먼저 들어가 주세요.");
  const text = address.trim();
  if (text.length > 200) throw new MapServiceError("주소는 200자 안으로 적어 주세요.");
  await assertTextsAllowed(text);
  if (!text) {
    await getDb()
      .update(members)
      .set({
        address: null,
        pickupLat: null,
        pickupLon: null,
        pickupConsentAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(members.id, seen.membership.memberId), eq(members.communityId, seen.communityId)));
    return;
  }
  const point = await lookupAddressPoint(text);
  if (!point) throw new MapServiceError("이 주소를 지도에서 찾지 못했습니다.");
  await getDb()
    .update(members)
    .set({
      address: text,
      pickupLat: point.lat,
      pickupLon: point.lon,
      updatedAt: new Date(),
    })
    .where(and(eq(members.id, seen.membership.memberId), eq(members.communityId, seen.communityId)));
}

export async function setPickupConsent(agreed: boolean): Promise<void> {
  const seen = await viewer();
  if (!seen) throw new MapServiceError("동의하려면 먼저 들어가 주세요.");
  const rows = await getDb()
    .select({
      address: members.address,
      pickupLat: members.pickupLat,
      pickupLon: members.pickupLon,
    })
    .from(members)
    .where(and(eq(members.id, seen.membership.memberId), eq(members.communityId, seen.communityId)))
    .limit(1);
  const mine = rows[0];
  if (agreed && (!mine?.address?.trim() || !finitePoint(mine.pickupLat, mine.pickupLon))) {
    throw new MapServiceError("주소가 없어 지도에 올리지 않습니다.");
  }
  await getDb()
    .update(members)
    .set({
      pickupConsentAt: agreed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(members.id, seen.membership.memberId), eq(members.communityId, seen.communityId)));
}
