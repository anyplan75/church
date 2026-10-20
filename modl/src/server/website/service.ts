/**
 * 열린 안뜨레 저장, 공개 페이지, 방문 문의입니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 줄은 섞지 않습니다.
 */

import { headers } from "next/headers";
import { and, desc, eq, sql } from "drizzle-orm";
import QRCode from "qrcode";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, can, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { bulletins, calendarEvents, communities, surveys, websiteConfigs, websiteInquiries } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import {
  atSitePath,
  blocksForPublic,
  DEFAULT_SEO,
  DEFAULT_THEME,
  inquiryPushReady,
  parseBlocks,
  parseInquiry,
  parseSeo,
  parseTheme,
  pickLatestPublicBulletin,
  publicSitePath,
  upcomingPublicEvents,
  type BulletinPick,
  type EventPick,
  type LinkedBulletin,
  type LinkedEvent,
  type LinkedSurvey,
  type WebsiteBlock,
  type WebsitePlan,
  type WebsiteSeo,
  type WebsiteTheme,
} from "@/website/rules";

export class WebsiteFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebsiteFlowError";
  }
}

export function readableWebsiteError(error: unknown): string {
  if (error instanceof WebsiteFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "홈페이지를 처리하지 못했습니다.";
}

export async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host")?.split(",")[0]?.trim() || headerList.get("host") || "127.0.0.1:3210";
  const proto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return `${proto}://${host}`;
}

function dayText(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isoText(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString();
}

async function requireEditor(actor: Actor, communityId: string) {
  assertApprovedMember(actor, communityId);
  if (!formalMembership(actor, communityId)) {
    throw new WebsiteFlowError("이 공동체 구성원이 아니어서 홈페이지를 고칠 수 없습니다.");
  }
  assertCan(actor, { type: "manage_website", communityId });
}

export type WebsiteNotice = {
  id: string;
  visitorName: string;
  visitorContact: string;
  message: string;
  isResolved: boolean;
  createdAt: string;
};

async function linkedContent(communityId: string, blocks: WebsiteBlock[]) {
  const db = getDb();
  const bulletinRows = await db
    .select({
      id: bulletins.id,
      worshipDate: bulletins.worshipDate,
      sermonTitle: bulletins.sermonTitle,
      isPublic: bulletins.isPublic,
      shareToken: bulletins.shareToken,
    })
    .from(bulletins)
    .where(eq(bulletins.communityId, communityId));
  const picks: BulletinPick[] = bulletinRows.map((row) => ({
    id: row.id,
    worshipDate: dayText(row.worshipDate),
    sermonTitle: row.sermonTitle,
    isPublic: row.isPublic,
    shareToken: row.shareToken,
  }));
  const latest = pickLatestPublicBulletin(picks);
  const bulletin: LinkedBulletin | null = latest?.shareToken
    ? { title: latest.sermonTitle, worshipDate: latest.worshipDate, href: `/bulletin/share/${latest.shareToken}` }
    : null;

  const eventRows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      startAt: calendarEvents.startAt,
      category: calendarEvents.category,
      isLeaderOnly: calendarEvents.isLeaderOnly,
      communityId: calendarEvents.communityId,
    })
    .from(calendarEvents)
    .where(eq(calendarEvents.communityId, communityId));
  const events: LinkedEvent[] = upcomingPublicEvents(
    eventRows.map(
      (row): EventPick => ({
        id: row.id,
        title: row.title,
        startAt: isoText(row.startAt),
        category: row.category,
        isLeaderOnly: row.isLeaderOnly,
        communityId: row.communityId,
      }),
    ),
    communityId,
    new Date().toISOString(),
  ).map((row) => ({ id: row.id, title: row.title, startAt: row.startAt }));

  const surveyRows = await db
    .select({
      id: surveys.id,
      title: surveys.title,
      allowAnonymous: surveys.allowAnonymous,
      deadline: surveys.deadline,
    })
    .from(surveys)
    .where(eq(surveys.communityId, communityId))
    .orderBy(desc(surveys.createdAt));
  const now = new Date();
  const openAnonymous = surveyRows.filter((row) => row.allowAnonymous && (!row.deadline || row.deadline.getTime() >= now.getTime()));
  const wanted = blocks.find((block) => block.type === "link_survey")?.surveyId ?? "";
  const chosen = openAnonymous.find((row) => row.id === wanted) ?? openAnonymous[0] ?? null;
  const survey: LinkedSurvey | null = chosen ? { id: chosen.id, title: chosen.title, href: `/survey/${chosen.id}` } : null;
  return {
    bulletin,
    events,
    survey,
    surveyChoices: openAnonymous.map((row) => ({ id: row.id, title: row.title })),
  };
}

export async function loadWebsiteEditor(origin: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "홈페이지를 고치려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 홈페이지를 고칠 수 없습니다." };
  }
  if (!can(actor, { type: "manage_website", communityId })) {
    return { ok: false as const, message: "홈페이지 편집은 사역자와 임원만 합니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const [config] = await db.select().from(websiteConfigs).where(eq(websiteConfigs.communityId, communityId)).limit(1);
  const theme = parseTheme(config?.themeJson ?? DEFAULT_THEME);
  const seo = parseSeo(config?.seoJson ?? DEFAULT_SEO);
  const parsedBlocks = parseBlocks(config?.blocksJson ?? []);
  const blocks = parsedBlocks.ok ? parsedBlocks.blocks : [];
  const linked = await linkedContent(communityId, blocks);
  const notices = await db
    .select()
    .from(websiteInquiries)
    .where(eq(websiteInquiries.communityId, communityId))
    .orderBy(desc(websiteInquiries.createdAt));
  const publicPath = publicSitePath(community.slug);
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(`${origin}${publicPath}`, { margin: 1, width: 240 });
  } catch {
    qrDataUrl = "";
  }
  return {
    ok: true as const,
    communityName: community.name,
    slug: community.slug,
    planTier: community.planTier as WebsitePlan,
    theme,
    seo,
    blocks,
    visitCount: config?.visitCount ?? 0,
    publicPath,
    atPath: atSitePath(community.slug),
    qrDataUrl,
    pushReady: inquiryPushReady({ INQUIRY_PUSH_KEY: process.env.INQUIRY_PUSH_KEY }),
    notices: notices.map(
      (row): WebsiteNotice => ({
        id: row.id,
        visitorName: row.visitorName,
        visitorContact: row.visitorContact,
        message: row.message,
        isResolved: row.isResolved,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
    bulletin: linked.bulletin,
    events: linked.events,
    survey: linked.survey,
    surveyChoices: linked.surveyChoices,
  };
}

export async function saveWebsite(input: { blocks: WebsiteBlock[]; theme: WebsiteTheme; seo: WebsiteSeo }): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new WebsiteFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  await requireEditor(actor, communityId);
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) throw new WebsiteFlowError("공동체를 찾지 못했습니다.");
  const [existing] = await db.select().from(websiteConfigs).where(eq(websiteConfigs.communityId, communityId)).limit(1);
  const values = {
    slug: community.slug,
    themeJson: input.theme,
    seoJson: input.seo,
    blocksJson: input.blocks,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(websiteConfigs).set(values).where(eq(websiteConfigs.id, existing.id));
    return;
  }
  await db.insert(websiteConfigs).values({
    communityId,
    ...values,
  });
}

export async function loadPublicSite(slug: string, countVisit: boolean) {
  await ensureDatabase();
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.slug, slug)).limit(1);
  if (!community) return null;
  const [config] = await db.select().from(websiteConfigs).where(eq(websiteConfigs.communityId, community.id)).limit(1);
  if (!config) return null;
  assertCan(await loadActor(), { type: "view_open_website", communityId: community.id });
  const theme = parseTheme(config.themeJson);
  const seo = parseSeo(config.seoJson);
  const parsed = parseBlocks(config.blocksJson);
  const stored = parsed.ok ? parsed.blocks : [];
  const blocks = blocksForPublic(stored, community.planTier);
  const linked = await linkedContent(community.id, stored);
  let visitCount = config.visitCount;
  if (countVisit) {
    const [updated] = await db
      .update(websiteConfigs)
      .set({ visitCount: sql`${websiteConfigs.visitCount} + 1`, updatedAt: new Date() })
      .where(eq(websiteConfigs.id, config.id))
      .returning({ visitCount: websiteConfigs.visitCount });
    if (updated) visitCount = updated.visitCount;
  }
  return {
    communityName: community.name,
    slug: community.slug,
    planTier: community.planTier as WebsitePlan,
    theme,
    seo,
    blocks,
    bulletin: community.planTier === "PRO" ? linked.bulletin : null,
    events: community.planTier === "PRO" ? linked.events : [],
    survey: community.planTier === "PRO" ? linked.survey : null,
    visitCount,
    languageMode: community.languageMode,
    overridesJson: JSON.stringify(community.customTermOverrides ?? {}),
  };
}

export async function submitInquiry(input: {
  slug: string;
  visitorName: string;
  visitorContact: string;
  message: string;
}): Promise<void> {
  await ensureDatabase();
  const parsed = parseInquiry(input);
  if (!parsed.ok) throw new WebsiteFlowError(parsed.message);
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.slug, input.slug)).limit(1);
  if (!community) throw new WebsiteFlowError("홈페이지를 찾지 못했습니다.");
  const [config] = await db.select().from(websiteConfigs).where(eq(websiteConfigs.communityId, community.id)).limit(1);
  if (!config) throw new WebsiteFlowError("홈페이지를 찾지 못했습니다.");
  const actor = await loadActor();
  assertCan(actor, { type: "submit_website_inquiry", communityId: community.id });
  await db.insert(websiteInquiries).values({
    communityId: community.id,
    visitorName: parsed.visitorName,
    visitorContact: parsed.visitorContact,
    message: parsed.message,
  });
}

export async function resolveInquiry(inquiryId: string): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new WebsiteFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  await requireEditor(actor, communityId);
  const db = getDb();
  const [row] = await db
    .select()
    .from(websiteInquiries)
    .where(and(eq(websiteInquiries.id, inquiryId), eq(websiteInquiries.communityId, communityId)))
    .limit(1);
  if (!row) throw new WebsiteFlowError("문의를 찾지 못했습니다.");
  await db
    .update(websiteInquiries)
    .set({ isResolved: true, updatedAt: new Date() })
    .where(and(eq(websiteInquiries.id, row.id), eq(websiteInquiries.communityId, communityId)));
}
