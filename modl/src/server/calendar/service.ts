/**
 * 공동체 일정을 저장하고, 생일은 명부에서 그 달에 보여 줍니다.
 * 구글 달력은 열쇠가 네 개 모두 있을 때만 보내고, 없으면 보냈다고 말하지 않습니다.
 */

import { and, asc, eq, gte, lt } from "drizzle-orm";
import {
  birthdaysForActor,
  eventsForActor,
  formatLocalDateTime,
  type BirthdayMark,
  type CalendarCategory,
} from "@/calendar/rules";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertCan, assertSameCommunity, can, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { pushGoogleEvent, readGoogleCalendarConfig, readGoogleCalendarWait, removeGoogleEvent } from "@/server/calendar/google";
import { calendarEvents, communities, members } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";

export class CalendarFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarFlowError";
  }
}

export function readableCalendarError(error: unknown): string {
  if (error instanceof CalendarFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "일정을 처리하지 못했습니다.";
}

async function requireCommunity(actor: Actor): Promise<string> {
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    throw new CalendarFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  }
  return communityId;
}

function monthWindow(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 1, 0, 0, 0, 0),
  };
}

async function rememberGoogleId(communityId: string, eventId: string, googleEventId: string) {
  await getDb()
    .update(calendarEvents)
    .set({ googleEventId, updatedAt: new Date() })
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.communityId, communityId)));
}

export async function loadCalendarMonth(year: number, month: number) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "일정을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 일정을 볼 수 없습니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const window = monthWindow(year, month);
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.communityId, communityId),
        lt(calendarEvents.startAt, window.end),
        gte(calendarEvents.endAt, window.start),
      ),
    )
    .orderBy(asc(calendarEvents.startAt));
  const leaderView = can(actor, { type: "view_leader_calendar", communityId });
  const visible = eventsForActor(rows, communityId, true, leaderView);
  const people = await db
    .select({ id: members.id, name: members.name, birthDate: members.birthDate })
    .from(members)
    .where(eq(members.communityId, communityId));
  const birthdays: BirthdayMark[] = birthdaysForActor(
    people.map((person) => ({ memberId: person.id, name: person.name, birthDate: person.birthDate })),
    year,
    month,
    true,
  );
  return {
    ok: true as const,
    communityName: community.name,
    canEdit: leaderView,
    googleReady: readGoogleCalendarWait() === "ready",
    googleNeedsCalendar: readGoogleCalendarWait() === "needs_calendar",
    events: visible.map((event) => ({
      id: event.id,
      title: event.title,
      startAt: formatLocalDateTime(event.startAt),
      endAt: formatLocalDateTime(event.endAt),
      category: event.category,
      isLeaderOnly: event.isLeaderOnly,
      googleEventId: event.googleEventId,
    })),
    birthdays,
  };
}

export async function loadCalendarEvent(eventId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "일정을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 일정을 볼 수 없습니다." };
  }
  const db = getDb();
  const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!event) return { ok: false as const, message: "일정을 찾지 못했습니다." };
  try {
    assertSameCommunity(communityId, event.communityId);
  } catch (error) {
    return { ok: false as const, message: readableCalendarError(error) };
  }
  const leaderView = can(actor, { type: "view_leader_calendar", communityId });
  const visible = eventsForActor([event], communityId, true, leaderView);
  if (visible.length === 0) return { ok: false as const, message: "이 일정은 볼 수 없습니다." };
  return {
    ok: true as const,
    canEdit: leaderView,
    googleReady: readGoogleCalendarWait() === "ready",
    googleNeedsCalendar: readGoogleCalendarWait() === "needs_calendar",
    event: {
      id: event.id,
      title: event.title,
      startAt: formatLocalDateTime(event.startAt),
      endAt: formatLocalDateTime(event.endAt),
      category: event.category,
      isLeaderOnly: event.isLeaderOnly,
      googleEventId: event.googleEventId,
    },
  };
}

async function sendIfConfigured(communityId: string, eventId: string): Promise<"skipped" | "synced" | "failed"> {
  const config = readGoogleCalendarConfig();
  if (!config) return "skipped";
  const db = getDb();
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.communityId, communityId)))
    .limit(1);
  if (!event) return "failed";
  try {
    const googleEventId = await pushGoogleEvent(config, {
      googleEventId: event.googleEventId,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
    });
    await rememberGoogleId(communityId, event.id, googleEventId);
    return "synced";
  } catch {
    return "failed";
  }
}

export async function saveCalendarEvent(input: {
  eventId: string | null;
  title: string;
  startAt: Date;
  endAt: Date;
  category: CalendarCategory;
  isLeaderOnly: boolean;
}): Promise<{ id: string; google: "skipped" | "synced" | "failed" }> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  assertCan(actor, { type: "view_leader_calendar", communityId });
  if (input.endAt.getTime() < input.startAt.getTime()) {
    throw new CalendarFlowError("끝나는 시각은 시작보다 빠를 수 없습니다.");
  }
  const db = getDb();
  let eventId = input.eventId;
  if (!eventId) {
    const [created] = await db
      .insert(calendarEvents)
      .values({
        communityId,
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        category: input.category,
        isLeaderOnly: input.isLeaderOnly,
      })
      .returning({ id: calendarEvents.id });
    eventId = created.id;
  } else {
    const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
    if (!existing) throw new CalendarFlowError("일정을 찾지 못했습니다.");
    assertSameCommunity(communityId, existing.communityId);
    await db
      .update(calendarEvents)
      .set({
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        category: input.category,
        isLeaderOnly: input.isLeaderOnly,
        updatedAt: new Date(),
      })
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.communityId, communityId)));
  }
  const google = await sendIfConfigured(communityId, eventId);
  return { id: eventId, google };
}

export async function syncCalendarEvent(eventId: string): Promise<"skipped" | "synced" | "failed"> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  assertCan(actor, { type: "view_leader_calendar", communityId });
  const [existing] = await getDb().select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!existing) throw new CalendarFlowError("일정을 찾지 못했습니다.");
  assertSameCommunity(communityId, existing.communityId);
  const config = readGoogleCalendarConfig();
  if (!config) {
    throw new CalendarFlowError("구글 달력 열쇠가 있어야 보낼 수 있습니다. 모들 달력은 그대로 씁니다.");
  }
  return sendIfConfigured(communityId, eventId);
}

export async function deleteCalendarEvent(eventId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  assertCan(actor, { type: "view_leader_calendar", communityId });
  const db = getDb();
  const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!existing) throw new CalendarFlowError("일정을 찾지 못했습니다.");
  assertSameCommunity(communityId, existing.communityId);
  const config = readGoogleCalendarConfig();
  if (config && existing.googleEventId) {
    try {
      await removeGoogleEvent(config, existing.googleEventId);
    } catch {
      throw new CalendarFlowError("구글 달력에서 빼지 못해 모들 일정은 그대로 둡니다.");
    }
  }
  await db.delete(calendarEvents).where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.communityId, communityId)));
}
