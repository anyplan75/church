/**
 * 공동체 일정을 저장하고, 생일은 명부에서 그 달에 보여 줍니다.
 * 구글 달력은 보낼 열쇠가 있을 때만 보내고, 없으면 보냈다고 말하지 않습니다.
 * 달력 번호가 있으면 그 달력의 실제 일정만 읽어 화면에 얹습니다. 읽은 일정을 새로 만들지 않습니다.
 */

import { and, asc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import {
  birthdaysForActor,
  eventsForMemberships,
  formatLocalDateTime,
  seoulMonthRange,
  type BirthdayMark,
  type CalendarCategory,
  type CalendarMembership,
  type GoogleEventView,
} from "@/calendar/rules";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertCan, assertSameCommunity, can, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import {
  pushGoogleEvent,
  readGoogleCalendarCanWrite,
  readGoogleCalendarConfig,
  readGoogleCalendarHasId,
  readGoogleCalendarMonth,
  readGoogleCalendarWait,
  removeGoogleEvent,
  type GoogleCalendarReadResult,
} from "@/server/calendar/google";
import { calendarEvents, communities, groupMemberships, members, smallGroups } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";

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

async function groupsForActor(actor: Extract<Actor, { kind: "user" }>) {
  const churchIds = [...new Set(actor.memberships.map((item) => item.communityId))];
  if (churchIds.length === 0) return [];
  const memberIds = actor.memberships.map((item) => item.memberId);
  const idSet = new Set<string>();
  for (const item of actor.memberships) {
    if (item.currentGroupId) idSet.add(item.currentGroupId);
    for (const id of item.leaderGroupIds) idSet.add(id);
  }
  const db = getDb();
  if (memberIds.length > 0) {
    const openRows = await db
      .select({ groupId: groupMemberships.groupId })
      .from(groupMemberships)
      .where(and(inArray(groupMemberships.memberId, memberIds), isNull(groupMemberships.endedAt)));
    for (const row of openRows) idSet.add(row.groupId);
  }
  if (idSet.size === 0) return [];
  return db
    .select({ id: smallGroups.id, name: smallGroups.name, communityId: smallGroups.communityId })
    .from(smallGroups)
    .where(and(inArray(smallGroups.id, [...idSet]), eq(smallGroups.isArchived, false), inArray(smallGroups.communityId, churchIds)));
}

function membershipScopes(
  actor: Extract<Actor, { kind: "user" }>,
  groups: readonly { id: string; communityId: string }[],
): CalendarMembership[] {
  return actor.memberships.map((item) => ({
    communityId: item.communityId,
    groupIds: groups.filter((group) => group.communityId === item.communityId).map((group) => group.id),
    canViewLeaderCalendar: can(actor, { type: "view_leader_calendar", communityId: item.communityId }),
  }));
}

async function assertOwnGroup(actor: Actor, communityId: string, groupId: string | null) {
  if (!groupId || actor.kind !== "user") return;
  const groups = await groupsForActor(actor);
  const owns = groups.some((group) => group.id === groupId && group.communityId === communityId);
  if (!owns) throw new CalendarFlowError("그 모들 일정은 만들 수 없습니다.");
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
  const churchIds = [...new Set(actor.memberships.map((item) => item.communityId))];
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const window = monthWindow(year, month);
  const groups = await groupsForActor(actor);
  const scopes = membershipScopes(actor, groups);
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        inArray(calendarEvents.communityId, churchIds),
        lt(calendarEvents.startAt, window.end),
        gte(calendarEvents.endAt, window.start),
      ),
    )
    .orderBy(asc(calendarEvents.startAt));
  const visible = eventsForMemberships(rows, scopes);
  const churchRows = await db
    .select({ id: communities.id, name: communities.name })
    .from(communities)
    .where(inArray(communities.id, churchIds));
  const churchNames = new Map(churchRows.map((row) => [row.id, row.name]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const people = await db
    .select({ id: members.id, name: members.name, birthDate: members.birthDate })
    .from(members)
    .where(inArray(members.communityId, churchIds));
  const birthdays: BirthdayMark[] = birthdaysForActor(
    people.map((person) => ({ memberId: person.id, name: person.name, birthDate: person.birthDate })),
    year,
    month,
    true,
  );
  const range = seoulMonthRange(year, month);
  let google: GoogleCalendarReadResult = { status: "skipped", items: [] };
  try {
    google = await readGoogleCalendarMonth(range.timeMin, range.timeMax);
  } catch {
    google = { status: "failed", items: [] };
  }
  const knownGoogleIds = new Set(visible.map((event) => event.googleEventId).filter((id): id is string => Boolean(id)));
  const googleEvents: GoogleEventView[] = google.items.filter((item) => !knownGoogleIds.has(item.id));
  const leaderView = can(actor, { type: "view_leader_calendar", communityId });
  return {
    ok: true as const,
    communityName: community.name,
    canEdit: leaderView,
    myGroups: groups
      .filter((group) => group.communityId === communityId)
      .map((group) => ({ id: group.id, name: group.name }))
      .sort((left, right) => left.name.localeCompare(right.name, "ko")),
    googleCanWrite: readGoogleCalendarCanWrite(),
    googleNeedsCalendar: readGoogleCalendarWait() === "needs_calendar",
    googleHasId: readGoogleCalendarHasId(),
    googleRead: google.status,
    events: visible.map((event) => {
      const scope = event.groupId ? groupNames.get(event.groupId) ?? "모들" : churchNames.get(event.communityId) ?? "교회";
      return {
        id: event.id,
        title: `${scope} · ${event.title}`,
        startAt: formatLocalDateTime(event.startAt),
        endAt: formatLocalDateTime(event.endAt),
        category: event.category,
        isLeaderOnly: event.isLeaderOnly,
        googleEventId: event.googleEventId,
      };
    }),
    birthdays,
    googleEvents,
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
  const groups = await groupsForActor(actor);
  const visible = eventsForMemberships([event], membershipScopes(actor, groups));
  if (visible.length === 0) return { ok: false as const, message: "이 일정은 볼 수 없습니다." };
  const leaderView = event.communityId === communityId && can(actor, { type: "view_leader_calendar", communityId: event.communityId });
  return {
    ok: true as const,
    canEdit: leaderView,
    myGroups: groups
      .filter((group) => group.communityId === event.communityId)
      .map((group) => ({ id: group.id, name: group.name }))
      .sort((left, right) => left.name.localeCompare(right.name, "ko")),
    googleCanWrite: readGoogleCalendarCanWrite(),
    googleNeedsCalendar: readGoogleCalendarWait() === "needs_calendar",
    googleHasId: readGoogleCalendarHasId(),
    event: {
      id: event.id,
      title: event.title,
      startAt: formatLocalDateTime(event.startAt),
      endAt: formatLocalDateTime(event.endAt),
      category: event.category,
      isLeaderOnly: event.isLeaderOnly,
      groupId: event.groupId,
      googleEventId: event.googleEventId,
    },
  };
}

async function sendIfConfigured(communityId: string, eventId: string): Promise<"skipped" | "synced" | "failed"> {
  const config = readGoogleCalendarConfig();
  if (!config?.clientId || !config.clientSecret || !config.refreshToken) return "skipped";
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
  groupId: string | null;
}): Promise<{ id: string; google: "skipped" | "synced" | "failed" }> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  assertCan(actor, { type: "view_leader_calendar", communityId });
  if (input.endAt.getTime() < input.startAt.getTime()) {
    throw new CalendarFlowError("끝나는 시각은 시작보다 빠를 수 없습니다.");
  }
  await assertTextsAllowed(input.title);
  await assertOwnGroup(actor, communityId, input.groupId);
  const db = getDb();
  let eventId = input.eventId;
  if (!eventId) {
    const [created] = await db
      .insert(calendarEvents)
      .values({
        communityId,
        groupId: input.groupId,
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
    await assertOwnGroup(actor, existing.communityId, input.groupId);
    await db
      .update(calendarEvents)
      .set({
        groupId: input.groupId,
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
  if (!config?.clientId || !config.clientSecret || !config.refreshToken) {
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
