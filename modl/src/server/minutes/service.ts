/**
 * 회의록을 모들마다 저장합니다.
 * 속한 모들의 기록만 보고, 교회 회의록은 만들지 않습니다.
 */

import { and, asc, desc, inArray, isNull } from "drizzle-orm";
import { isHttpUrl, textLines } from "@/finance/rules";
import { PermissionError } from "@/server/auth/membership";
import { loadActor } from "@/server/auth/session";
import { meetingMinutes, smallGroups } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";
import { loadPlaceScope, placeCommunity } from "@/server/place/service";

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
  const scope = await loadPlaceScope(actor.userId);
  const db = getDb();
  const gatherings = scope.groupIds.size
    ? await db
        .select({ id: smallGroups.id, name: smallGroups.name })
        .from(smallGroups)
        .where(inArray(smallGroups.id, [...scope.groupIds]))
        .orderBy(asc(smallGroups.name))
    : [];
  const rows = gatherings.length
    ? await db
        .select()
        .from(meetingMinutes)
        .where(and(inArray(meetingMinutes.groupId, gatherings.map((row) => row.id)), isNull(meetingMinutes.churchId)))
        .orderBy(desc(meetingMinutes.meetingDate))
    : [];
  return {
    ok: true as const,
    gatherings: gatherings.map((row) => ({ id: row.id, name: row.name })),
    minutes: rows
      .filter((row) => row.groupId && !row.churchId)
      .map((row) => ({
        id: row.id,
        groupId: row.groupId as string,
        meetingDate: row.meetingDate,
        attendees: stringList(row.attendees),
        content: row.content,
        attachmentUrls: stringList(row.attachmentUrls),
      })),
  };
}

export async function createMinutes(input: {
  gatheringId: string;
  meetingDate: string;
  attendeesText: string;
  content: string;
  attachmentText: string;
}): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") throw new MinutesFlowError("회의록을 쓰려면 먼저 들어가 주세요.");
  const scope = await loadPlaceScope(actor.userId);
  if (!scope.groupIds.has(input.gatheringId)) throw new MinutesFlowError("속한 모들의 회의록만 쓸 수 있습니다.");
  const attachmentUrls = textLines(input.attachmentText);
  for (const url of attachmentUrls) {
    if (!isHttpUrl(url)) throw new MinutesFlowError("첨부 주소는 http 로 시작해 주세요.");
  }
  await assertTextsAllowed(input.attendeesText, input.content, attachmentUrls);
  const communityId = await placeCommunity("gathering", input.gatheringId);
  const db = getDb();
  await db.insert(meetingMinutes).values({
    communityId,
    churchId: null,
    groupId: input.gatheringId,
    meetingDate: input.meetingDate,
    attendees: textLines(input.attendeesText),
    content: input.content.trim(),
    attachmentUrls,
  });
}
