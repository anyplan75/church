/**
 * 교회나 모들의 홍보 페이지를 읽고 저장합니다.
 * 관리자로 지정된 사람만 고칩니다.
 */

import { eq } from "drizzle-orm";
import { cleanIntro, cleanPromo, promoTexts, readPromoContent, type PromoContent } from "@/promo/rules";
import { loadActor } from "@/server/auth/session";
import { mapChurches, promoPages, smallGroups } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";

export class PromoFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromoFlowError";
  }
}

export type PromoKind = "church" | "gathering";

export function readablePromoError(error: unknown): string {
  if (error instanceof PromoFlowError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "홍보 페이지를 처리하지 못했습니다.";
}

export type PromoPage = {
  kind: PromoKind;
  id: string;
  name: string;
  manager: boolean;
  intro: string;
  content: PromoContent;
};

type PlaceRow = { id: string; name: string; createdByUserId: string | null };

async function placeOf(kind: PromoKind, id: string): Promise<PlaceRow | null> {
  const db = getDb();
  if (kind === "church") {
    const [row] = await db
      .select({ id: mapChurches.id, name: mapChurches.name, createdByUserId: mapChurches.createdByUserId })
      .from(mapChurches)
      .where(eq(mapChurches.id, id))
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select({ id: smallGroups.id, name: smallGroups.name, createdByUserId: smallGroups.createdByUserId })
    .from(smallGroups)
    .where(eq(smallGroups.id, id))
    .limit(1);
  return row ?? null;
}

async function pageRow(kind: PromoKind, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(promoPages)
    .where(kind === "church" ? eq(promoPages.churchId, id) : eq(promoPages.groupId, id))
    .limit(1);
  return row ?? null;
}

export async function loadPromo(kind: PromoKind, id: string): Promise<PromoPage | null> {
  await ensureDatabase();
  const place = await placeOf(kind, id);
  if (!place) return null;
  const row = await pageRow(kind, id);
  const actor = await loadActor();
  return {
    kind,
    id: place.id,
    name: place.name,
    manager: actor.kind === "user" && place.createdByUserId === actor.userId,
    intro: row?.intro ?? "",
    content: readPromoContent(row?.youtubeJson, row?.tabsJson, row?.instagram ?? ""),
  };
}

/** 로그인 여부와 상관없이 공개 SNS 주소만 읽습니다. 바깥 글 캐시에 쓰기 좋습니다. */
export async function loadPromoPublicContent(
  kind: PromoKind,
  id: string,
): Promise<{ name: string; content: PromoContent } | null> {
  await ensureDatabase();
  const place = await placeOf(kind, id);
  if (!place) return null;
  const row = await pageRow(kind, id);
  return {
    name: place.name,
    content: readPromoContent(row?.youtubeJson, row?.tabsJson, row?.instagram ?? ""),
  };
}

async function requireManager(kind: PromoKind, id: string): Promise<PlaceRow> {
  const actor = await loadActor();
  if (actor.kind !== "user") throw new PromoFlowError("먼저 들어가 주세요.");
  const place = await placeOf(kind, id);
  if (!place) throw new PromoFlowError(kind === "church" ? "교회를 찾지 못했습니다." : "모들을 찾지 못했습니다.");
  if (place.createdByUserId !== actor.userId) throw new PromoFlowError("설정은 관리자에게만 보입니다.");
  return place;
}

export async function savePromo(kind: PromoKind, id: string, input: Parameters<typeof cleanPromo>[0]) {
  await ensureDatabase();
  await requireManager(kind, id);
  const cleaned = cleanPromo(input);
  if (!cleaned.ok) throw new PromoFlowError(cleaned.message);
  const existing = await pageRow(kind, id);
  await assertTextsAllowed(promoTexts(cleaned.content, existing?.intro ?? ""));
  const db = getDb();
  const values = {
    instagram: cleaned.content.instagram,
    youtubeJson: cleaned.content.youtube,
    tabsJson: cleaned.content.tabs,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(promoPages).set(values).where(eq(promoPages.id, existing.id));
    return;
  }
  await db.insert(promoPages).values({
    churchId: kind === "church" ? id : null,
    groupId: kind === "gathering" ? id : null,
    intro: "",
    ...values,
  });
}

export async function saveChurchIntro(churchId: string, introText: string) {
  await ensureDatabase();
  await requireManager("church", churchId);
  const cleaned = cleanIntro(introText);
  if (!cleaned.ok) throw new PromoFlowError(cleaned.message);
  const existing = await pageRow("church", churchId);
  await assertTextsAllowed(cleaned.intro);
  const db = getDb();
  if (existing) {
    await db.update(promoPages).set({ intro: cleaned.intro, updatedAt: new Date() }).where(eq(promoPages.id, existing.id));
    return;
  }
  await db.insert(promoPages).values({
    churchId,
    groupId: null,
    instagram: "",
    intro: cleaned.intro,
    youtubeJson: [],
    tabsJson: [],
  });
}
