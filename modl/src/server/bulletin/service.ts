/**
 * 주일 기별을 저장하고 공개 주소로 읽습니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 줄은 섞지 않습니다.
 */

import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { kakaoConfigFromEnv, nextShareState, parseBlocks, type BulletinBlock, type KakaoShareConfig } from "@/bulletin/blocks";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertCan, assertSameCommunity } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { bulletinsForActor, canPublishBulletin } from "@/server/bulletin/access";
import { bulletins, communities } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
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
  const rows = await db
    .select()
    .from(bulletins)
    .where(eq(bulletins.communityId, communityId))
    .orderBy(desc(bulletins.worshipDate), desc(bulletins.createdAt));
  const visible = bulletinsForActor(
    actor,
    communityId,
    rows.map((row) => ({
      id: row.id,
      communityId: row.communityId,
      isPublic: row.isPublic,
      worshipDate: row.worshipDate,
      sermonTitle: row.sermonTitle,
    })),
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    ok: true as const,
    communityName: community.name,
    canPublish: canPublishBulletin(actor, communityId),
    bulletins: visible.map((item) => {
      const row = byId.get(item.id);
      return {
        id: item.id,
        worshipDate: item.worshipDate,
        sermonTitle: item.sermonTitle,
        isPublic: item.isPublic,
        shareToken: row?.shareToken ?? null,
      };
    }),
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

export async function saveBulletin(input: {
  bulletinId: string | null;
  worshipDate: string;
  sermonTitle: string;
  scriptureText: string;
  preacher: string;
  blocks: BulletinBlock[];
  intent: "save" | "publish";
}) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  assertCan(actor, { type: "publish_bulletin", communityId });
  const parsed = parseBlocks(input.blocks);
  if (!parsed.ok) throw new BulletinFlowError(parsed.message);

  const db = getDb();
  if (!input.bulletinId) {
    const share = nextShareState({ isPublic: false, shareToken: null }, input.intent, makeShareToken);
    const [created] = await db
      .insert(bulletins)
      .values({
        communityId,
        worshipDate: input.worshipDate,
        sermonTitle: input.sermonTitle,
        scriptureText: input.scriptureText,
        preacher: input.preacher,
        blocksJson: parsed.blocks,
        isPublic: share.isPublic,
        shareToken: share.shareToken,
      })
      .returning({ id: bulletins.id });
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
  await db
    .update(bulletins)
    .set({
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
  return existing.id;
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
    title: found.sermonTitle.trim() || "주일 기별",
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
