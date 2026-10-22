/**
 * 회의록을 저장합니다.
 * 사역자와 임원만 보고, 다른 공동체 줄은 섞지 않습니다.
 */

import { desc, eq } from "drizzle-orm";
import { isHttpUrl, textLines } from "@/finance/rules";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, meetingMinutes } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";

export class MinutesFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MinutesFlowError";
  }
}

export function readableMinutesError(error: unknown): string {
  if (error instanceof MinutesFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "회의록을 처리하지 못했습니다.";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function loadMinutesHome() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "회의록을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 회의록을 볼 수 없습니다." };
  }
  if (!canManage(actor, communityId)) {
    return { ok: false as const, message: "회의록은 사역자와 임원만 봅니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const rows = await db
    .select()
    .from(meetingMinutes)
    .where(eq(meetingMinutes.communityId, communityId))
    .orderBy(desc(meetingMinutes.meetingDate));
  return {
    ok: true as const,
    communityName: community.name,
    minutes: rows.map((row) => ({
      id: row.id,
      meetingDate: row.meetingDate,
      attendees: stringList(row.attendees),
      content: row.content,
      attachmentUrls: stringList(row.attachmentUrls),
    })),
  };
}

function canManage(actor: Actor, communityId: string): boolean {
  try {
    assertCan(actor, { type: "manage_surveys_and_minutes", communityId });
    return true;
  } catch {
    return false;
  }
}

export async function createMinutes(input: {
  meetingDate: string;
  attendeesText: string;
  content: string;
  attachmentText: string;
}): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new MinutesFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  assertApprovedMember(actor, communityId);
  if (!formalMembership(actor, communityId)) {
    throw new MinutesFlowError("이 공동체 구성원이 아니어서 회의록을 쓸 수 없습니다.");
  }
  assertCan(actor, { type: "manage_surveys_and_minutes", communityId });
  const attachmentUrls = textLines(input.attachmentText);
  for (const url of attachmentUrls) {
    if (!isHttpUrl(url)) throw new MinutesFlowError("첨부 주소는 http 로 시작해 주세요.");
  }
  await assertTextsAllowed(input.attendeesText, input.content, attachmentUrls);
  const db = getDb();
  await db.insert(meetingMinutes).values({
    communityId,
    meetingDate: input.meetingDate,
    attendees: textLines(input.attendeesText),
    content: input.content.trim(),
    attachmentUrls,
  });
}
