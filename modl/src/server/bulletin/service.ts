/**
 * 주일 기별을 저장하고 공개 주소로 읽습니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 줄은 섞지 않습니다.
 */

import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { kakaoConfigFromEnv, nextShareState, parseBlocks, type BulletinBlock, type KakaoShareConfig } from "@/bulletin/blocks";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertCan, assertSameCommunity } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { bulletinsForActor, canPublishBulletin } from "@/server/bulletin/access";
import { bulletins, communities, mapChurches, smallGroups } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { currentChurchIdFor, loadPlaceScope, visibleSharedRows } from "@/server/place/service";
import { replaceBulletinSchedule } from "@/server/calendar/from-bulletin";
import { assertTextsAllowed } from "@/server/moderation/guard";
import type { LanguageMode } from "@/theme/types";

export class BulletinFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulletinFlowError";
  }
}

export function readableBulletinError(error: unknown): string {
  if (error instanceof BulletinFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "주보를 처리하지 못했습니다.";
}

export function readKakaoShareConfig(): KakaoShareConfig | null {
  return kakaoConfigFromEnv({
    KAKAO_JAVASCRIPT_KEY: process.env.KAKAO_JAVASCRIPT_KEY,
    KAKAO_SHARE_TEMPLATE_ID: process.env.KAKAO_SHARE_TEMPLATE_ID,
  });
}

function makeShareToken(): string {
  return randomBytes(18).toString("base64url");
}

async function requireCommunity(actor: Actor): Promise<string> {
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    throw new BulletinFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  }
  return communityId;
}

export type BulletinRecord = {
  id: string;
  communityId: string;
  worshipDate: string;
  serviceLabel: string;
  serviceTime: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocks: BulletinBlock[];
  isPublic: boolean;
  shareToken: string | null;
};

function toRecord(row: {
  id: string;
  communityId: string;
  worshipDate: string;
  serviceLabel: string;
  serviceTime: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocksJson: unknown;
  isPublic: boolean;
  shareToken: string | null;
}): BulletinRecord {
  const parsed = parseBlocks(row.blocksJson);
  if (!parsed.ok) {
    throw new BulletinFlowError(parsed.message);
  }
  return {
    id: row.id,
    communityId: row.communityId,
    worshipDate: row.worshipDate,
    serviceLabel: row.serviceLabel,
    serviceTime: row.serviceTime,
    sermonTitle: row.sermonTitle,
    scriptureText: row.scriptureText,
    preacher: row.preacher,
    blocks: parsed.blocks,
    isPublic: row.isPublic,
    shareToken: row.shareToken,
  };
}

export async function loadBulletinList() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "주보를 보려면 먼저 들어가 주세요. 공개 주보는 받은 주소로만 열 수 있습니다." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const scope = await loadPlaceScope(actor.userId);
  const churchIds = [...scope.churchIds];
  const groupIds = [...scope.groupIds];
  const filters = [
    churchIds.length > 0 ? inArray(bulletins.churchId, churchIds) : undefined,
    groupIds.length > 0 ? inArray(bulletins.groupId, groupIds) : undefined,
    and(eq(bulletins.communityId, communityId), isNull(bulletins.churchId), isNull(bulletins.groupId)),
  ].filter((item) => item !== undefined);
  const where = filters.length === 1 ? filters[0] : or(...filters);
  const rows = visibleSharedRows(
    await db.select().from(bulletins).where(where).orderBy(desc(bulletins.worshipDate), desc(bulletins.createdAt)),
    scope,
  );
  const attached = rows.filter((row) => (row.churchId && scope.churchIds.has(row.churchId)) || (row.groupId && scope.groupIds.has(row.groupId)));
  const legacy = bulletinsForActor(
    actor,
    communityId,
    rows
      .filter((row) => !row.churchId && !row.groupId)
      .map((row) => ({
        id: row.id,
        communityId: row.communityId,
        isPublic: row.isPublic,
        worshipDate: row.worshipDate,
        sermonTitle: row.sermonTitle,
        serviceLabel: row.serviceLabel,
      })),
  );
  const chosen = new Map<string, (typeof rows)[number]>();
  for (const row of attached) chosen.set(row.id, row);
  for (const item of legacy) {
    const row = rows.find((candidate) => candidate.id === item.id);
    if (row) chosen.set(row.id, row);
  }
  const visible = [...chosen.values()].sort((left, right) => {
    if (left.worshipDate === right.worshipDate) return left.createdAt < right.createdAt ? 1 : -1;
    return left.worshipDate < right.worshipDate ? 1 : -1;
  });
  const namedChurches = churchIds.length
    ? await db.select({ id: mapChurches.id, name: mapChurches.name }).from(mapChurches).where(inArray(mapChurches.id, churchIds))
    : [];
  const namedGroups = groupIds.length
    ? await db.select({ id: smallGroups.id, name: smallGroups.name }).from(smallGroups).where(inArray(smallGroups.id, groupIds))
    : [];
  const churchNames = new Map(namedChurches.map((row) => [row.id, row.name]));
  const groupNames = new Map(namedGroups.map((row) => [row.id, row.name]));
  return {
    ok: true as const,
    communityName: community.name,
    canPublish: canPublishBulletin(actor, communityId),
    bulletins: visible.map((row) => ({
      id: row.id,
      worshipDate: row.worshipDate,
      serviceLabel: row.serviceLabel,
      serviceTime: row.serviceTime,
      sermonTitle: row.sermonTitle,
      isPublic: row.isPublic,
      shareToken: row.shareToken,
      placeLabel: row.churchId ? churchNames.get(row.churchId) ?? "교회" : row.groupId ? groupNames.get(row.groupId) ?? "모들" : "",
    })),
  };
}

export async function loadBulletin(id: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "이 주보를 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const db = getDb();
  const [row] = await db.select().from(bulletins).where(eq(bulletins.id, id)).limit(1);
  if (!row) return { ok: false as const, message: "주보를 찾지 못했습니다." };
  assertSameCommunity(communityId, row.communityId);
  assertCan(actor, { type: "view_public_bulletin", communityId, isPublic: row.isPublic });
  return {
    ok: true as const,
    canPublish: canPublishBulletin(actor, communityId),
    bulletin: toRecord(row),
    kakao: readKakaoShareConfig(),
  };
}

async function bulletinPlace(actor: Actor, kind: string, id: string): Promise<{ communityId: string; churchId: string | null; groupId: string | null }> {
  if (kind && id) {
    if (actor.kind !== "user") throw new BulletinFlowError("안내는 그 교회나 모들 관리자가 설정에서 만듭니다.");
    const db = getDb();
    if (kind === "church") {
      const [row] = await db
        .select({ communityId: mapChurches.communityId, createdByUserId: mapChurches.createdByUserId })
        .from(mapChurches)
        .where(eq(mapChurches.id, id))
        .limit(1);
      if (!row || row.createdByUserId !== actor.userId) {
        throw new BulletinFlowError("안내는 그 교회나 모들 관리자가 설정에서 만듭니다.");
      }
      return { communityId: row.communityId, churchId: id, groupId: null };
    }
    if (kind === "gathering") {
      const [row] = await db
        .select({ communityId: smallGroups.communityId, createdByUserId: smallGroups.createdByUserId })
        .from(smallGroups)
        .where(eq(smallGroups.id, id))
        .limit(1);
      if (!row || row.createdByUserId !== actor.userId) {
        throw new BulletinFlowError("안내는 그 교회나 모들 관리자가 설정에서 만듭니다.");
      }
      return { communityId: row.communityId, churchId: null, groupId: id };
    }
    throw new BulletinFlowError("안내는 그 교회나 모들 관리자가 설정에서 만듭니다.");
  }
  const communityId = await requireCommunity(actor);
  assertCan(actor, { type: "publish_bulletin", communityId });
  return {
    communityId,
    churchId: actor.kind === "user" ? await currentChurchIdFor(actor.userId) : null,
    groupId: null,
  };
}

export async function saveBulletin(input: {
  bulletinId: string | null;
  worshipDate: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocks: BulletinBlock[];
  intent: "save" | "publish";
  placeKind?: string;
  placeId?: string;
}) {
  await ensureDatabase();
  const actor = await loadActor();
  const placed = await bulletinPlace(actor, input.placeKind ?? "", input.placeId ?? "");
  const communityId = placed.communityId;
  const parsed = parseBlocks(input.blocks);
  if (!parsed.ok) throw new BulletinFlowError(parsed.message);
  await assertTextsAllowed(input.sermonTitle, input.scriptureText, input.preacher, parsed.blocks);

  const db = getDb();
  const currentChurchId = placed.churchId;
  const groupId = placed.groupId;
  if (!input.bulletinId) {
    const share = nextShareState({ isPublic: false, shareToken: null }, input.intent, makeShareToken);
    const [created] = await db
      .insert(bulletins)
      .values({
        communityId,
        churchId: currentChurchId,
        groupId,
        worshipDate: input.worshipDate,
        sermonTitle: input.sermonTitle,
        scriptureText: input.scriptureText,
        preacher: input.preacher,
        blocksJson: parsed.blocks,
        isPublic: share.isPublic,
        shareToken: share.shareToken,
      })
        .returning({ id: bulletins.id });
    await replaceBulletinSchedule(communityId, created.id, {
      label: "",
      time: "",
      worshipDate: input.worshipDate,
      sermonTitle: input.sermonTitle,
      blocks: parsed.blocks,
      churchId: currentChurchId,
    });
    return created.id;
  }

  const [existing] = await db.select().from(bulletins).where(eq(bulletins.id, input.bulletinId)).limit(1);
  if (!existing) throw new BulletinFlowError("주보를 찾지 못했습니다.");
  assertSameCommunity(communityId, existing.communityId);
  const share = nextShareState(
    { isPublic: existing.isPublic, shareToken: existing.shareToken },
    input.intent,
    makeShareToken,
  );
  const churchId = existing.churchId ?? currentChurchId;
  await db
    .update(bulletins)
    .set({
      churchId,
      worshipDate: input.worshipDate,
      sermonTitle: input.sermonTitle,
      scriptureText: input.scriptureText,
      preacher: input.preacher,
      blocksJson: parsed.blocks,
      isPublic: share.isPublic,
      shareToken: share.shareToken,
      updatedAt: new Date(),
    })
    .where(and(eq(bulletins.id, existing.id), eq(bulletins.communityId, communityId)));
  await replaceBulletinSchedule(communityId, existing.id, {
    label: existing.serviceLabel,
    time: existing.serviceTime,
    worshipDate: input.worshipDate,
    sermonTitle: input.sermonTitle,
    blocks: parsed.blocks,
    churchId,
  });
  return existing.id;
}

export async function saveBulletinWeek(
  services: Array<{
    label: string;
    time: string;
    worshipDate: string;
    sermonTitle: string;
    scriptureText: string;
    preacher: string;
    blocks: BulletinBlock[];
  }>,
  place?: { kind: string; id: string },
) {
  await ensureDatabase();
  const actor = await loadActor();
  const placed = await bulletinPlace(actor, place?.kind ?? "", place?.id ?? "");
  const communityId = placed.communityId;
  if (services.length === 0) throw new BulletinFlowError("저장할 예배가 없습니다.");
  const ready = services.map((service) => {
    const parsed = parseBlocks(service.blocks);
    if (!parsed.ok) throw new BulletinFlowError(parsed.message);
    return { ...service, blocks: parsed.blocks };
  });
  await assertTextsAllowed(ready);
  const db = getDb();
  const churchId = placed.churchId;
  const groupId = placed.groupId;
  const ids = await db.transaction(async (tx) => {
    const created: string[] = [];
    for (const service of ready) {
      const [row] = await tx
        .insert(bulletins)
        .values({
          communityId,
          churchId,
          groupId,
          worshipDate: service.worshipDate,
          serviceLabel: service.label,
          serviceTime: service.time,
          sermonTitle: service.sermonTitle,
          scriptureText: service.scriptureText,
          preacher: service.preacher,
          blocksJson: service.blocks,
          isPublic: false,
          shareToken: null,
        })
        .returning({ id: bulletins.id });
      created.push(row.id);
      await replaceBulletinSchedule(
        communityId,
        row.id,
        {
          label: service.label,
          time: service.time,
          worshipDate: service.worshipDate,
          sermonTitle: service.sermonTitle,
          blocks: service.blocks,
          churchId,
        },
        tx,
      );
    }
    return created;
  });
  return ids;
}

export async function unpublishBulletin(bulletinId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  assertCan(actor, { type: "publish_bulletin", communityId });
  const db = getDb();
  const [existing] = await db.select().from(bulletins).where(eq(bulletins.id, bulletinId)).limit(1);
  if (!existing) throw new BulletinFlowError("주보를 찾지 못했습니다.");
  assertSameCommunity(communityId, existing.communityId);
  const share = nextShareState(
    { isPublic: existing.isPublic, shareToken: existing.shareToken },
    "unpublish",
    makeShareToken,
  );
  await db
    .update(bulletins)
    .set({
      isPublic: share.isPublic,
      shareToken: share.shareToken,
      updatedAt: new Date(),
    })
    .where(and(eq(bulletins.id, existing.id), eq(bulletins.communityId, communityId)));
}

export type PublicBulletinPage = {
  communityName: string;
  languageMode: LanguageMode;
  overridesJson: string;
  worshipDate: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocks: BulletinBlock[];
  title: string;
  description: string;
  sharePath: string;
};

export async function loadPublicBulletin(token: string): Promise<PublicBulletinPage | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  await ensureDatabase();
  const db = getDb();
  const [found] = await db
    .select({
      worshipDate: bulletins.worshipDate,
      serviceLabel: bulletins.serviceLabel,
      sermonTitle: bulletins.sermonTitle,
      scriptureText: bulletins.scriptureText,
      preacher: bulletins.preacher,
      blocksJson: bulletins.blocksJson,
      isPublic: bulletins.isPublic,
      shareToken: bulletins.shareToken,
      communityName: communities.name,
      languageMode: communities.languageMode,
      overrides: communities.customTermOverrides,
    })
    .from(bulletins)
    .innerJoin(communities, eq(communities.id, bulletins.communityId))
    .where(eq(bulletins.shareToken, trimmed))
    .limit(1);
  if (!found) return null;
  try {
    assertCan({ kind: "guest" }, { type: "view_bulletin_share_token", isPublic: found.isPublic });
  } catch {
    return null;
  }
  if (!found.shareToken || found.shareToken !== trimmed || !found.isPublic) return null;
  const parsed = parseBlocks(found.blocksJson);
  if (!parsed.ok) return null;
  const fields = {
    title: found.sermonTitle.trim() || found.serviceLabel.trim() || "주일 기별",
    description: [found.worshipDate, found.preacher.trim(), found.scriptureText.trim()]
      .filter((part) => part.length > 0)
      .join(" · ")
      .slice(0, 180),
  };
  return {
    communityName: found.communityName,
    languageMode: found.languageMode,
    overridesJson: JSON.stringify(found.overrides ?? {}),
    worshipDate: found.worshipDate,
    sermonTitle: found.sermonTitle,
    scriptureText: found.scriptureText,
    preacher: found.preacher,
    blocks: parsed.blocks,
    title: fields.title,
    description: fields.description,
    sharePath: `/bulletin/share/${found.shareToken}`,
  };
}
