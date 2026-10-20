/**
 * 출석 모임을 만들고, 본인 체크인과 테우리 출석을 저장합니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 줄은 섞지 않습니다.
 */

import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  attendanceRates,
  canLeaderEditMember,
  canSeeAbsenceCard,
  checkMethodForMark,
  nextMemberStatus,
  planSelfCheck,
  sortMembersForLeader,
  type AttendanceStatus,
  type MemberLifeStatus,
  type RateBar,
} from "@/attendance/rules";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, assertSameCommunity, can, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { attendanceRecords, attendanceSessions, communities, members } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";

export class AttendanceFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceFlowError";
  }
}

export function readableAttendanceError(error: unknown): string {
  if (error instanceof AttendanceFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "출석을 처리하지 못했습니다.";
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const current = error as { code?: unknown; cause?: unknown };
  if (current.code === "23505") return true;
  return isUniqueViolation(current.cause);
}

function makeQrToken(): string {
  return randomBytes(18).toString("base64url");
}

async function requireCommunity(actor: Actor): Promise<string> {
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    throw new AttendanceFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  }
  return communityId;
}

async function refreshMemberStatus(communityId: string, memberId: string): Promise<void> {
  const db = getDb();
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.communityId, communityId)))
    .limit(1);
  if (!member) return;
  const rows = await db
    .select({
      sessionId: attendanceSessions.id,
      sessionDate: attendanceSessions.sessionDate,
      status: attendanceRecords.status,
    })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
    .where(and(eq(attendanceRecords.memberId, memberId), eq(attendanceSessions.communityId, communityId)));
  const next = nextMemberStatus(member.status as MemberLifeStatus, rows);
  if (next === member.status) return;
  await db
    .update(members)
    .set({ status: next, updatedAt: new Date() })
    .where(and(eq(members.id, memberId), eq(members.communityId, communityId)));
}

export async function loadAttendanceHome() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "출석을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 출석을 볼 수 없습니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const sessions = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.communityId, communityId))
    .orderBy(desc(attendanceSessions.sessionDate), desc(attendanceSessions.createdAt));
  const absentPeople = await db
    .select()
    .from(members)
    .where(and(eq(members.communityId, communityId), eq(members.status, "LONG_ABSENT")));
  const cards = absentPeople
    .filter((person) =>
      canSeeAbsenceCard({
        viewerRole: membership.role,
        viewerLeaderGroupIds: membership.leaderGroupIds,
        subjectGroupId: person.currentGroupId,
      }),
    )
    .map((person) => ({ memberId: person.id, name: person.name }))
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));
  const canCreate = can(actor, { type: "view_attendance_stats", communityId });
  const canSeeStats = canCreate || (membership.role === "CELL_LEADER" && membership.leaderGroupIds.length > 0);
  return {
    ok: true as const,
    communityName: community.name,
    canCreate,
    canSeeStats,
    sessions: sessions.map((session) => ({
      id: session.id,
      title: session.title,
      sessionDate: session.sessionDate,
      departmentType: session.departmentType,
    })),
    cards,
  };
}

export async function createSession(input: { departmentType: "YOUTH" | "SCHOOL"; title: string; sessionDate: string }) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  assertCan(actor, { type: "view_attendance_stats", communityId });
  const db = getDb();
  const [created] = await db
    .insert(attendanceSessions)
    .values({
      communityId,
      departmentType: input.departmentType,
      title: input.title,
      sessionDate: input.sessionDate,
      qrCheckinToken: makeQrToken(),
    })
    .returning({ id: attendanceSessions.id });
  return created.id;
}

export async function loadSession(sessionId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "출석을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const db = getDb();
  const [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId)).limit(1);
  if (!session) return { ok: false as const, message: "출석 모임을 찾지 못했습니다." };
  try {
    assertSameCommunity(communityId, session.communityId);
  } catch (error) {
    return { ok: false as const, message: readableAttendanceError(error) };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 출석을 볼 수 없습니다." };
  }
  const roster = await db.select().from(members).where(eq(members.communityId, communityId));
  const records = await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, session.id));
  const recordByMember = new Map(records.map((row) => [row.memberId, row]));
  const canEditEveryone = can(actor, { type: "view_attendance_stats", communityId });
  const showRoll = canEditEveryone || membership.role === "CELL_LEADER";
  const sorted = sortMembersForLeader(
    roster.map((person) => ({
      memberId: person.id,
      name: person.name,
      currentGroupId: person.currentGroupId,
    })),
    membership.leaderGroupIds,
  );
  return {
    ok: true as const,
    session: {
      id: session.id,
      title: session.title,
      sessionDate: session.sessionDate,
      departmentType: session.departmentType,
      qrPath: `/attendance/qr/${session.qrCheckinToken}`,
    },
    showRoll,
    rows: showRoll
      ? sorted.map((person) => {
          const record = recordByMember.get(person.memberId);
          return {
            memberId: person.memberId,
            name: person.name,
            status: (record?.status ?? null) as AttendanceStatus | null,
            canEdit: canLeaderEditMember({
              role: membership.role,
              leaderGroupIds: membership.leaderGroupIds,
              memberGroupId: person.currentGroupId,
            }),
          };
        })
      : [],
  };
}

export async function markAttendance(input: { sessionId: string; memberId: string; status: AttendanceStatus }) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = assertApprovedMember(actor, communityId);
  const db = getDb();
  const [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, input.sessionId)).limit(1);
  if (!session) throw new AttendanceFlowError("출석 모임을 찾지 못했습니다.");
  assertSameCommunity(communityId, session.communityId);
  const [member] = await db.select().from(members).where(eq(members.id, input.memberId)).limit(1);
  if (!member) throw new AttendanceFlowError("식구를 찾지 못했습니다.");
  assertSameCommunity(communityId, member.communityId);
  assertCan(actor, {
    type: "manage_group_attendance",
    communityId,
    groupId: member.currentGroupId ?? "없는모들",
  });
  if (
    !canLeaderEditMember({
      role: membership.role,
      leaderGroupIds: membership.leaderGroupIds,
      memberGroupId: member.currentGroupId,
    })
  ) {
    throw new PermissionError("다른 모들 식구의 출석은 이 화면에서 고치지 못합니다.");
  }
  if (membership.role !== "PASTOR" && membership.role !== "EXECUTIVE" && membership.role !== "CELL_LEADER") {
    throw new PermissionError("이 일에는 권한이 없습니다.");
  }
  const checkMethod = checkMethodForMark(membership.role);
  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.sessionId, session.id), eq(attendanceRecords.memberId, member.id)))
    .limit(1);
  const values = {
    status: input.status,
    checkMethod,
    checkedAt: new Date(),
    updatedAt: new Date(),
  };
  try {
    if (existing) {
      await db.update(attendanceRecords).set(values).where(eq(attendanceRecords.id, existing.id));
    } else {
      await db.insert(attendanceRecords).values({
        sessionId: session.id,
        memberId: member.id,
        ...values,
      });
    }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    await db
      .update(attendanceRecords)
      .set(values)
      .where(and(eq(attendanceRecords.sessionId, session.id), eq(attendanceRecords.memberId, member.id)));
  }
  await refreshMemberStatus(communityId, member.id);
}

export async function selfCheckIn(token: string): Promise<"checked" | "kept"> {
  await ensureDatabase();
  const actor = await loadActor();
  const db = getDb();
  const [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.qrCheckinToken, token)).limit(1);
  if (!session) throw new AttendanceFlowError("출석 모임을 찾지 못했습니다.");
  const membership = assertApprovedMember(actor, session.communityId);
  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.sessionId, session.id), eq(attendanceRecords.memberId, membership.memberId)))
    .limit(1);
  const plan = planSelfCheck(existing ? { status: existing.status } : null);
  if (plan.kind === "keep") return "kept";
  try {
    await db.insert(attendanceRecords).values({
      sessionId: session.id,
      memberId: membership.memberId,
      status: plan.status,
      checkMethod: plan.checkMethod,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "kept";
    throw error;
  }
  await refreshMemberStatus(session.communityId, membership.memberId);
  return "checked";
}

export async function loadCheckIn(token: string) {
  await ensureDatabase();
  const actor = await loadActor();
  const db = getDb();
  const [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.qrCheckinToken, token)).limit(1);
  if (!session) return { ok: false as const, message: "출석 모임을 찾지 못했습니다." };
  if (actor.kind !== "user") {
    return {
      ok: true as const,
      title: session.title,
      sessionDate: session.sessionDate,
      canCheck: false,
      blocked: "출석을 남기려면 먼저 들어가 주세요.",
    };
  }
  const membership = formalMembership(actor, session.communityId);
  if (!membership) {
    return {
      ok: true as const,
      title: session.title,
      sessionDate: session.sessionDate,
      canCheck: false,
      blocked: "이 공동체 구성원만 출석을 남길 수 있습니다.",
    };
  }
  return {
    ok: true as const,
    title: session.title,
    sessionDate: session.sessionDate,
    canCheck: true,
    blocked: null,
  };
}

export async function loadAttendanceStats(): Promise<
  | { ok: false; message: string }
  | { ok: true; scope: "community" | "group"; week: RateBar[]; month: RateBar[]; year: RateBar[] }
> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false, message: "출석률을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 출석률을 볼 수 없습니다." };
  }
  const whole = can(actor, { type: "view_attendance_stats", communityId });
  const db = getDb();
  let memberIds: string[] | null = null;
  if (!whole) {
    if (membership.role !== "CELL_LEADER" || membership.leaderGroupIds.length === 0) {
      return { ok: false, message: "출석률은 사역자, 임원, 맡은 모들의 테우리만 봅니다." };
    }
    const groupMembers = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.communityId, communityId), inArray(members.currentGroupId, [...membership.leaderGroupIds])));
    memberIds = groupMembers.map((person) => person.id);
  }
  const rows =
    memberIds && memberIds.length === 0
      ? []
      : await db
          .select({
            sessionDate: attendanceSessions.sessionDate,
            status: attendanceRecords.status,
            memberId: attendanceRecords.memberId,
          })
          .from(attendanceRecords)
          .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
          .where(
            memberIds
              ? and(eq(attendanceSessions.communityId, communityId), inArray(attendanceRecords.memberId, memberIds))
              : eq(attendanceSessions.communityId, communityId),
          );
  const rates = attendanceRates(rows);
  return { ok: true, scope: whole ? "community" : "group", ...rates };
}
