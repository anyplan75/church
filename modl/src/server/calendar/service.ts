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
import { canSeeSharedRow } from "@/place/rules";
import { loadPlaceScope, placeCommunity } from "@/server/place/service";
import { calendarEvents, communities, groupMemberships, mapChurches, members, smallGroups } from "@/server/db/schema";
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
  const scope = await loadPlaceScope(actor.userId);
  if (scope.churchIds.size === 0 && scope.groupIds.size === 0 && scope.formalCommunityIds.size === 0) {
    return { ok: false as const, message: "속한 교회나 모임이 없습니다." };
  }
  const db = getDb();
  const communityId = (await activeCommunityId(actor)) ?? [...scope.formalCommunityIds][0] ?? null;
  const [community] = communityId
    ? await db.select().from(communities).where(eq(communities.id, communityId)).limit(1)
    : [undefined];
  const window = monthWindow(year, month);
  const groups = await groupsForActor(actor);
  const placeCommunityIds = new Set(scope.formalCommunityIds);
  if (scope.churchIds.size > 0) {
    const owned = await db
      .select({ communityId: mapChurches.communityId })
      .from(mapChurches)
      .where(inArray(mapChurches.id, [...scope.churchIds]));
    for (const row of owned) placeCommunityIds.add(row.communityId);
  }
  if (scope.groupIds.size > 0) {
    const owned = await db
      .select({ communityId: smallGroups.communityId })
      .from(smallGroups)
      .where(inArray(smallGroups.id, [...scope.groupIds]));
    for (const row of owned) placeCommunityIds.add(row.communityId);
  }
  const churchIds = [...placeCommunityIds];
  const rows = churchIds.length
    ? await db
        .select()
        .from(calendarEvents)
        .where(
          and(
            inArray(calendarEvents.communityId, churchIds),
            lt(calendarEvents.startAt, window.end),
            gte(calendarEvents.endAt, window.start),
          ),
        )
        .orderBy(asc(calendarEvents.startAt))
    : [];
  const visible = rows.filter((event) => {
    if (!canSeeSharedRow(event, scope.churchIds, scope.groupIds, scope.formalCommunityIds)) return false;
    if (!event.isLeaderOnly) return true;
    if (event.groupId) return scope.editGroupIds.has(event.groupId);
    if (event.churchId) return scope.editChurchIds.has(event.churchId);
    return false;
  });
  const churchRows = churchIds.length
    ? await db.select({ id: communities.id, name: communities.name }).from(communities).where(inArray(communities.id, churchIds))
    : [];
  const churchNames = new Map(churchRows.map((row) => [row.id, row.name]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const people = churchIds.length
    ? await db
        .select({ id: members.id, name: members.name, birthDate: members.birthDate })
        .from(members)
        .where(inArray(members.communityId, churchIds))
    : [];
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
  const followedChurchRows = scope.churchIds.size
    ? await db.select({ id: mapChurches.id, name: mapChurches.name }).from(mapChurches).where(inArray(mapChurches.id, [...scope.churchIds]))
    : [];
  const followedGroupRows = scope.groupIds.size
    ? await db.select({ id: smallGroups.id, name: smallGroups.name }).from(smallGroups).where(inArray(smallGroups.id, [...scope.groupIds]))
    : [];
  const churchPlaceNames = new Map(followedChurchRows.map((row) => [row.id, row.name]));
  const groupPlaceNames = new Map(followedGroupRows.map((row) => [row.id, row.name]));
  const places = [
    ...[...scope.editChurchIds].map((id) => ({ id, name: churchPlaceNames.get(id) ?? "교회", kind: "church" as const })),
    ...[...scope.editGroupIds].map((id) => ({ id, name: groupPlaceNames.get(id) ?? "모임", kind: "gathering" as const })),
  ].sort((left, right) => left.name.localeCompare(right.name, "ko"));
  return {
    ok: true as const,
    communityName: community?.name ?? "",
    canEdit: places.length > 0,
    places,
    myGroups: places.filter((place) => place.kind === "gathering").map((place) => ({ id: place.id, name: place.name })),
    googleCanWrite: readGoogleCalendarCanWrite(),
    googleNeedsCalendar: readGoogleCalendarWait() === "needs_calendar",
    googleHasId: readGoogleCalendarHasId(),
    googleRead: google.status,
    events: visible.map((event) => {
      const scopeLabel = event.groupId
        ? groupPlaceNames.get(event.groupId) ?? groupNames.get(event.groupId) ?? "모들"
        : event.churchId
          ? churchPlaceNames.get(event.churchId) ?? "교회"
          : churchNames.get(event.communityId) ?? "교회";
      return {
        id: event.id,
        title: `${scopeLabel} · ${event.title}`,
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
  const scope = await loadPlaceScope(actor.userId);
  if (scope.churchIds.size === 0 && scope.groupIds.size === 0 && scope.formalCommunityIds.size === 0) {
    return { ok: false as const, message: "속한 교회나 모임이 없습니다." };
  }
  const db = getDb();
  const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!event) return { ok: false as const, message: "일정을 찾지 못했습니다." };
  if (!canSeeSharedRow(event, scope.churchIds, scope.groupIds, scope.formalCommunityIds)) {
    return { ok: false as const, message: "이 일정은 볼 수 없습니다." };
  }
  const canEdit = event.groupId ? scope.editGroupIds.has(event.groupId) : event.churchId ? scope.editChurchIds.has(event.churchId) : false;
  const churchRows = scope.editChurchIds.size
    ? await db.select({ id: mapChurches.id, name: mapChurches.name }).from(mapChurches).where(inArray(mapChurches.id, [...scope.editChurchIds]))
    : [];
  const groupRows = scope.editGroupIds.size
    ? await db.select({ id: smallGroups.id, name: smallGroups.name }).from(smallGroups).where(inArray(smallGroups.id, [...scope.editGroupIds]))
    : [];
  const places = [
    ...churchRows.map((row) => ({ id: row.id, name: row.name, kind: "church" as const })),
    ...groupRows.map((row) => ({ id: row.id, name: row.name, kind: "gathering" as const })),
  ];
  return {
    ok: true as const,
    canEdit,
    places,
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
      churchId: event.churchId,
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
  churchId: string | null;
}): Promise<{ id: string; google: "skipped" | "synced" | "failed" }> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") throw new CalendarFlowError("일정을 고치려면 먼저 들어가 주세요.");
  const scope = await loadPlaceScope(actor.userId);
  const targetGroup = input.groupId;
  const targetChurch = targetGroup ? null : input.churchId;
  if (targetGroup) {
    if (!scope.editGroupIds.has(targetGroup)) throw new CalendarFlowError("이 모임의 일정을 고칠 권한이 없습니다.");
  } else if (targetChurch) {
    if (!scope.editChurchIds.has(targetChurch)) throw new CalendarFlowError("이 교회의 일정을 고칠 권한이 없습니다.");
  } else {
    throw new CalendarFlowError("일정을 둘 교회나 모임을 골라 주세요.");
  }
  const communityId = await placeCommunity(targetGroup ? "gathering" : "church", targetGroup ?? targetChurch ?? "");
  if (input.endAt.getTime() < input.startAt.getTime()) {
    throw new CalendarFlowError("끝나는 시각은 시작보다 빠를 수 없습니다.");
  }
  await assertTextsAllowed(input.title);
  const db = getDb();
  let eventId = input.eventId;
  if (!eventId) {
    const [created] = await db
      .insert(calendarEvents)
      .values({
        communityId,
        groupId: targetGroup,
        churchId: targetChurch,
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
    if (existing.groupId ? !scope.editGroupIds.has(existing.groupId) : existing.churchId ? !scope.editChurchIds.has(existing.churchId) : true) {
      throw new CalendarFlowError("이 일정을 고칠 권한이 없습니다.");
    }
    await db
      .update(calendarEvents)
      .set({
        communityId,
        groupId: targetGroup,
        churchId: targetChurch,
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        category: input.category,
        isLeaderOnly: input.isLeaderOnly,
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, eventId));
  }
  const google = await sendIfConfigured(communityId, eventId);
  return { id: eventId, google };
}

export async function syncCalendarEvent(eventId: string): Promise<"skipped" | "synced" | "failed"> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") throw new CalendarFlowError("일정을 고치려면 먼저 들어가 주세요.");
  const scope = await loadPlaceScope(actor.userId);
  const [existing] = await getDb().select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!existing) throw new CalendarFlowError("일정을 찾지 못했습니다.");
  const allowed = existing.groupId ? scope.editGroupIds.has(existing.groupId) : existing.churchId ? scope.editChurchIds.has(existing.churchId) : false;
  if (!allowed) throw new CalendarFlowError("이 일정을 고칠 권한이 없습니다.");
  const communityId = existing.communityId;
  const config = readGoogleCalendarConfig();
  if (!config?.clientId || !config.clientSecret || !config.refreshToken) {
    throw new CalendarFlowError("구글 달력 열쇠가 있어야 보낼 수 있습니다. 모들 달력은 그대로 씁니다.");
  }
  return sendIfConfigured(communityId, eventId);
}

export async function deleteCalendarEvent(eventId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") throw new CalendarFlowError("일정을 고치려면 먼저 들어가 주세요.");
  const scope = await loadPlaceScope(actor.userId);
  const db = getDb();
  const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
  if (!existing) throw new CalendarFlowError("일정을 찾지 못했습니다.");
  const allowed = existing.groupId ? scope.editGroupIds.has(existing.groupId) : existing.churchId ? scope.editChurchIds.has(existing.churchId) : false;
  if (!allowed) throw new CalendarFlowError("이 일정을 고칠 권한이 없습니다.");
  const communityId = existing.communityId;
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
