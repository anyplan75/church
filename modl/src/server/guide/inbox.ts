/**
 * 메일로 온 안내를 승인 대기에 두고, 승인하면 그 교회나 모들 안내로 등록합니다.
 * 거절하면 주보를 만들지 않습니다.
 */

import { and, desc, eq, ne } from "drizzle-orm";
import type { BulletinServiceDraft } from "@/bulletin/intake";
import { canDecideGuide, matchGuidePlace, type GuidePlace } from "@/guide/match";
import { guideNews, guidePreviewLines, servicesFromJson } from "@/guide/present";
import type { Actor } from "@/server/auth/actor";
import { formalMembership } from "@/server/auth/membership";
import { loadActor } from "@/server/auth/session";
import { replaceBulletinSchedule } from "@/server/calendar/from-bulletin";
import { readGuideMaterial } from "@/server/bulletin/read-source";
import { bulletins, guideInbox, mapChurches, smallGroups, users } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { fetchGuideMail, gmailEnvFromProcess, type GuideFetchItem } from "@/server/guide/gmail";
import { BannedWordError, assertTextsAllowed } from "@/server/moderation/guard";

export class GuideInboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuideInboxError";
  }
}

export function readableGuideError(error: unknown): string {
  if (error instanceof GuideInboxError || error instanceof BannedWordError) return error.message;
  return "안내를 처리하지 못했습니다.";
}

type InboxPlace = GuidePlace & { creatorUserId: string | null };

export type GuideCard = {
  id: string;
  status: "pending" | "approved" | "rejected";
  subject: string;
  fromEmail: string;
  fromName: string;
  fileName: string;
  receivedLabel: string;
  placeLabel: string;
  unmatched: boolean;
  note: string;
  services: BulletinServiceDraft[];
  news: string;
  extraCount: number;
  bulletinHref: string | null;
};

export type GuideDesk = {
  operator: boolean;
  cards: GuideCard[];
  places: Array<{ value: string; label: string }>;
};

const PLACE_REF = /^(church|gathering):([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export function isSiteOperator(actor: Actor): boolean {
  if (actor.kind !== "user") return false;
  return actor.memberships.some((item) => formalMembership(actor, item.communityId)?.role === "PASTOR");
}

async function loadPlaces(): Promise<InboxPlace[]> {
  const db = getDb();
  const churches = await db
    .select({
      id: mapChurches.id,
      name: mapChurches.name,
      communityId: mapChurches.communityId,
      creatorUserId: mapChurches.createdByUserId,
      creatorEmail: users.email,
    })
    .from(mapChurches)
    .leftJoin(users, eq(mapChurches.createdByUserId, users.id));
  const groups = await db
    .select({
      id: smallGroups.id,
      name: smallGroups.name,
      communityId: smallGroups.communityId,
      creatorUserId: smallGroups.createdByUserId,
      creatorEmail: users.email,
    })
    .from(smallGroups)
    .leftJoin(users, eq(smallGroups.createdByUserId, users.id))
    .where(eq(smallGroups.isArchived, false));
  return [
    ...churches.map((row) => ({
      kind: "church" as const,
      id: row.id,
      communityId: row.communityId,
      name: row.name,
      creatorUserId: row.creatorUserId,
      creatorEmail: row.creatorEmail,
    })),
    ...groups.map((row) => ({
      kind: "gathering" as const,
      id: row.id,
      communityId: row.communityId,
      name: row.name,
      creatorUserId: row.creatorUserId,
      creatorEmail: row.creatorEmail,
    })),
  ];
}

function placeOf(row: { churchId: string | null; groupId: string | null }, places: readonly InboxPlace[]): InboxPlace | null {
  if (row.churchId) return places.find((place) => place.kind === "church" && place.id === row.churchId) ?? null;
  if (row.groupId) return places.find((place) => place.kind === "gathering" && place.id === row.groupId) ?? null;
  return null;
}

function canSee(actor: Actor, row: { churchId: string | null; groupId: string | null }, places: readonly InboxPlace[]): boolean {
  if (actor.kind !== "user") return false;
  const place = placeOf(row, places);
  return canDecideGuide({
    operator: isSiteOperator(actor),
    creator: Boolean(place && place.creatorUserId === actor.userId),
    matched: Boolean(place),
  });
}

function receivedLabel(value: Date | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function pastorCommunityIds(actor: Actor): string[] {
  if (actor.kind !== "user") return [];
  return actor.memberships
    .filter((item) => formalMembership(actor, item.communityId)?.role === "PASTOR")
    .map((item) => item.communityId);
}

export async function loadGuideDesk(): Promise<GuideDesk | null> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") return null;
  const places = await loadPlaces();
  const operator = isSiteOperator(actor);
  const creator = places.some((place) => place.creatorUserId === actor.userId);
  if (!operator && !creator) return null;
  const rows = await getDb()
    .select()
    .from(guideInbox)
    .where(ne(guideInbox.status, "skipped"))
    .orderBy(desc(guideInbox.createdAt))
    .limit(40);
  const visible = rows.filter((row) => canSee(actor, row, places));
  const communities = new Set(pastorCommunityIds(actor));
  const cards: GuideCard[] = visible.map((row) => {
    const place = placeOf(row, places);
    const services = servicesFromJson(row.servicesJson);
    const shown = guidePreviewLines(services);
    const bulletinId = Array.isArray(row.bulletinIds) ? row.bulletinIds.find((item) => typeof item === "string" && item) : "";
    const status = row.status === "approved" || row.status === "rejected" ? row.status : "pending";
    return {
      id: row.id,
      status,
      subject: row.subject,
      fromEmail: row.fromEmail,
      fromName: row.fromName,
      fileName: row.fileName,
      receivedLabel: receivedLabel(row.receivedAt),
      placeLabel: place?.name ?? "",
      unmatched: !place,
      note: row.note,
      services: shown,
      news: guideNews(services),
      extraCount: Math.max(0, services.length - shown.length),
      bulletinHref: status === "approved" && bulletinId ? `/bulletin/${bulletinId}` : null,
    };
  });
  return {
    operator,
    cards,
    places: places
      .filter((place) => communities.has(place.communityId))
      .map((place) => ({
        value: `${place.kind}:${place.id}`,
        label: `${place.kind === "church" ? "교회" : "모들"} · ${place.name}`,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "ko")),
  };
}

export async function pendingGuideCount(): Promise<number> {
  const desk = await loadGuideDesk();
  if (!desk) return 0;
  return desk.cards.filter((card) => card.status === "pending").length;
}

async function storeItem(item: GuideFetchItem, places: readonly InboxPlace[]): Promise<"pending" | "skipped" | "kept"> {
  const db = getDb();
  if (!item.guide) {
    const inserted = await db
      .insert(guideInbox)
      .values({
        gmailMessageId: item.gmailMessageId,
        fromEmail: item.fromEmail,
        fromName: item.fromName,
        subject: item.subject,
        receivedAt: item.receivedAt,
        status: "skipped",
      })
      .onConflictDoNothing({ target: guideInbox.gmailMessageId })
      .returning({ id: guideInbox.id });
    return inserted.length > 0 ? "skipped" : "kept";
  }
  const matched = matchGuidePlace({
    subject: item.subject,
    body: item.body,
    fileName: item.fileName,
    fromEmail: item.fromEmail,
    places,
  });
  let services: BulletinServiceDraft[] = [];
  let note = "";
  if (item.tooBig) {
    note = "파일은 30MB 이하로 올려 주세요.";
  } else if (item.bytes.length > 0) {
    const read = await readGuideMaterial(item.fileName || "bulletin", item.bytes, "");
    if (!read.ok) note = read.message;
    else if (!read.filled && item.body.trim()) {
      const bodyRead = await readGuideMaterial("", Buffer.alloc(0), item.body);
      if (!bodyRead.ok) note = bodyRead.message;
      else {
        note = bodyRead.note;
        services = bodyRead.filled ? bodyRead.services : [];
      }
    } else {
      note = read.note;
      services = read.filled ? read.services : [];
    }
  } else if (item.body.trim()) {
    const read = await readGuideMaterial("", Buffer.alloc(0), item.body);
    if (!read.ok) note = read.message;
    else {
      note = read.note;
      services = read.filled ? read.services : [];
    }
  } else {
    note = "예배 순서를 찾지 못했습니다. 칸은 비워 둡니다.";
  }
  const inserted = await db
    .insert(guideInbox)
    .values({
      gmailMessageId: item.gmailMessageId,
      fromEmail: item.fromEmail,
      fromName: item.fromName,
      subject: item.subject,
      fileName: item.fileName,
      receivedAt: item.receivedAt,
      communityId: matched?.communityId ?? null,
      churchId: matched?.kind === "church" ? matched.id : null,
      groupId: matched?.kind === "gathering" ? matched.id : null,
      status: "pending",
      servicesJson: services,
      note,
    })
    .onConflictDoNothing({ target: guideInbox.gmailMessageId })
    .returning({ id: guideInbox.id });
  return inserted.length > 0 ? "pending" : "kept";
}

export async function pullGuideMail(): Promise<{ ok: true; added: number } | { ok: false; reason: "unconfigured" | "mailbox" | "failed" }> {
  await ensureDatabase();
  const known = await getDb().select({ id: guideInbox.gmailMessageId }).from(guideInbox);
  const fetched = await fetchGuideMail(gmailEnvFromProcess(), new Set(known.map((row) => row.id)));
  if (!fetched.ok) return fetched;
  const places = await loadPlaces();
  let added = 0;
  for (const item of fetched.items) {
    const saved = await storeItem(item, places);
    if (saved === "pending") added += 1;
  }
  return { ok: true, added };
}

export function pullFailureMessage(reason: "unconfigured" | "mailbox" | "failed"): string {
  if (reason === "unconfigured") return "메일함을 서버에서 열지 못했습니다. Gmail 연결이 없습니다.";
  if (reason === "mailbox") return "메일함을 서버에서 열지 못했습니다. 지금 구글 계정으로는 그 편지함을 읽지 못합니다.";
  return "메일함을 읽지 못했습니다. 다시 눌러 주세요.";
}

async function pendingRow(id: string) {
  const [row] = await getDb().select().from(guideInbox).where(eq(guideInbox.id, id)).limit(1);
  if (!row || row.status !== "pending") throw new GuideInboxError("이미 처리된 안내입니다.");
  return row;
}

function chosenPlace(placeRef: string, places: readonly InboxPlace[], actor: Actor): InboxPlace {
  const match = PLACE_REF.exec(placeRef.trim());
  if (!match) throw new GuideInboxError("어느 교회·모들 안내인지 골라 주세요.");
  const kind = match[1] === "gathering" ? "gathering" : "church";
  const id = match[2] ?? "";
  const place = places.find((item) => item.kind === kind && item.id === id);
  if (!place) throw new GuideInboxError("어느 교회·모들 안내인지 골라 주세요.");
  const pastor = formalMembership(actor, place.communityId)?.role === "PASTOR";
  if (!pastor) throw new GuideInboxError("못 맞춘 안내는 사이트 운영자만 승인할 수 있습니다.");
  return place;
}

export async function approveGuide(id: string, placeRef: string): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") throw new GuideInboxError("안내 승인은 로그인한 뒤에 할 수 있습니다.");
  const places = await loadPlaces();
  const row = await pendingRow(id);
  const current = placeOf(row, places);
  const allowed = canDecideGuide({
    operator: isSiteOperator(actor),
    creator: Boolean(current && current.creatorUserId === actor.userId),
    matched: Boolean(current),
  });
  if (!allowed) throw new GuideInboxError("이 안내는 사이트 운영자나 그 교회·모들 담당만 승인할 수 있습니다.");
  const place = current ?? chosenPlace(placeRef, places, actor);
  const services = servicesFromJson(row.servicesJson);
  if (services.length === 0) throw new GuideInboxError("읽은 예배가 없어 등록하지 않습니다.");
  await assertTextsAllowed(services);
  const db = getDb();
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .update(guideInbox)
      .set({
        status: "approved",
        communityId: place.communityId,
        churchId: place.kind === "church" ? place.id : null,
        groupId: place.kind === "gathering" ? place.id : null,
        decidedByUserId: actor.userId,
        decidedAt: new Date(),
      })
      .where(and(eq(guideInbox.id, row.id), eq(guideInbox.status, "pending")))
      .returning({ id: guideInbox.id });
    if (!locked) throw new GuideInboxError("이미 처리된 안내입니다.");
    const ids: string[] = [];
    for (const service of services) {
      const [created] = await tx
        .insert(bulletins)
        .values({
          communityId: place.communityId,
          churchId: place.kind === "church" ? place.id : null,
          groupId: place.kind === "gathering" ? place.id : null,
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
      ids.push(created.id);
      await replaceBulletinSchedule(
        place.communityId,
        created.id,
        {
          label: service.label,
          time: service.time,
          worshipDate: service.worshipDate,
          sermonTitle: service.sermonTitle,
          blocks: service.blocks,
          churchId: place.kind === "church" ? place.id : null,
        },
        tx,
      );
    }
    await tx.update(guideInbox).set({ bulletinIds: ids }).where(eq(guideInbox.id, row.id));
  });
}

export async function rejectGuide(id: string): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") throw new GuideInboxError("안내 거절은 로그인한 뒤에 할 수 있습니다.");
  const places = await loadPlaces();
  const row = await pendingRow(id);
  const current = placeOf(row, places);
  const allowed = canDecideGuide({
    operator: isSiteOperator(actor),
    creator: Boolean(current && current.creatorUserId === actor.userId),
    matched: Boolean(current),
  });
  if (!allowed) throw new GuideInboxError("이 안내는 사이트 운영자나 그 교회·모들 담당만 거절할 수 있습니다.");
  const [locked] = await getDb()
    .update(guideInbox)
    .set({
      status: "rejected",
      decidedByUserId: actor.userId,
      decidedAt: new Date(),
    })
    .where(and(eq(guideInbox.id, row.id), eq(guideInbox.status, "pending")))
    .returning({ id: guideInbox.id });
  if (!locked) throw new GuideInboxError("이미 처리된 안내입니다.");
}
