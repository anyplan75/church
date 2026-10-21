/**
 * 공동체 교회와 데리러 가기 핀을 읽고 저장합니다.
 * 좌표는 주소 검색 결과만 쓰고, 없는 좌표는 만들지 않습니다.
 * 교회를 넣고 고치고 지우는 일은 사역자만 합니다.
 */

import { and, eq } from "drizzle-orm";
import { canSeePickupPin } from "@/map/access";
import { type ChurchInput, type ChurchPin, type ChurchRecord, parseChurchRows } from "@/map/church-sheet";
import type { MapPoint } from "@/map/rules";
import { formalMembership } from "@/server/auth/membership";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, mapChurches, members } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { geocodeAddress } from "@/server/map/mapbox";
import { MapServiceError } from "@/server/map/service";
import { assertTextsAllowed } from "@/server/moderation/guard";

export type MapSelf = {
  address: string;
  consented: boolean;
};

export type MapBoardData = {
  churches: ChurchPin[];
  pickups: Array<{ id: string; name: string; point: MapPoint }>;
  self: MapSelf | null;
  hasChurches: boolean;
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

async function operatorCommunityId(): Promise<string | null> {
  const rows = await getDb().select({ id: communities.id }).from(communities).where(eq(communities.slug, "modl")).limit(1);
  return rows[0]?.id ?? null;
}

export async function loadMapBoard(): Promise<MapBoardData> {
  const seen = await viewer();
  const communityId = seen?.communityId ?? (await operatorCommunityId());
  if (!communityId) return { churches: [], pickups: [], self: null, hasChurches: false };
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
      },
    ];
  });
  const pickups = memberRows.flatMap((row) => {
    if (!row.pickupConsentAt) return [];
    const point = finitePoint(row.pickupLat, row.pickupLon);
    if (!point) return [];
    if (
      !seen ||
      !canSeePickupPin({
        viewerUserId: seen.actor.userId,
        viewerRole: seen.membership.role,
        pinUserId: row.userId,
      })
    ) {
      return [];
    }
    return [{ id: row.id, name: row.name, point }];
  });
  const mine = seen ? memberRows.find((row) => row.id === seen.membership.memberId) ?? null : null;
  return {
    churches,
    pickups,
    self: mine ? { address: mine.address ?? "", consented: mine.pickupConsentAt !== null } : null,
    hasChurches: churchRows.length > 0,
  };
}

export async function loadChurchSettings(): Promise<ChurchSettings> {
  const seen = await viewer();
  if (!seen) return { ok: false, message: "교회 목록을 고치려면 사역자로 들어가 주세요." };
  if (seen.membership.role !== "PASTOR") return { ok: false, message: "교회 목록은 사역자만 고칩니다." };
  const rows = await getDb().select().from(mapChurches).where(eq(mapChurches.communityId, seen.communityId));
  return {
    ok: true,
    churches: rows.map((row) => ({
      id: row.id,
      name: row.name,
      pastorName: row.pastorName,
      address: row.address,
      phone: row.phone,
      serviceTime: row.serviceTime,
      memo: row.memo,
      pinned: Boolean(row.address.trim() && finitePoint(row.lat, row.lon)),
    })),
  };
}

async function writeChurch(communityId: string, church: ChurchInput, churchId: string | null): Promise<boolean> {
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
  const values = {
    name: church.name,
    pastorName: church.pastorName,
    address: church.address,
    phone: church.phone,
    serviceTime: church.serviceTime,
    memo: church.memo,
    lat: located.point?.lat ?? null,
    lon: located.point?.lon ?? null,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(mapChurches).set(values).where(eq(mapChurches.id, existing.id));
  } else {
    await db.insert(mapChurches).values({ communityId, ...values });
  }
  return located.missed;
}

export async function saveChurch(input: ChurchInput & { churchId?: string | null }): Promise<{ missed: boolean }> {
  const seen = await pastor();
  const church = cleanChurch(input);
  const missed = await writeChurch(seen.communityId, church, input.churchId?.trim() || null);
  return { missed };
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
    if (await writeChurch(seen.communityId, church, null)) missed += 1;
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
  const point = await geocodeAddress(text);
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
