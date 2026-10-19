/**
 * 공동체, 가입, 교적, 모들 편성 저장입니다.
 * 권한은 assertCan 으로만 확인하고, 다른 공동체 줄은 섞지 않습니다.
 */

import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Actor, MemberRole } from "@/server/auth/actor";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { assertCan, assertSameCommunity } from "@/server/auth/rbac";
import { assertApprovedMember, PermissionError } from "@/server/auth/membership";
import { activeCommunityId, currentUserName, loadActor, openSession, rememberCommunity } from "@/server/auth/session";
import {
  approvalRequests,
  communities,
  groupMemberships,
  inviteCodes,
  members,
  smallGroups,
  users,
} from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import type { CustomTermOverrides, LanguageMode } from "@/theme/types";
import { denominationsMatch, explainJoinBlock, groupIdsToArchive, planApproval } from "@/server/community/rules";

export class CommunityFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommunityFlowError";
  }
}

function flowError(error: unknown): string {
  if (error instanceof CommunityFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error) return error.message;
  return "처리하지 못했습니다.";
}

export function readableError(error: unknown): string {
  return flowError(error);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

function makeInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let raw = "";
  for (let index = 0; index < 8; index += 1) {
    raw += alphabet[bytes[index] % alphabet.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

async function communityForActor(actor: Actor) {
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    throw new CommunityFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  }
  return communityId;
}

export async function signupAccount(input: { name: string; email: string; password: string }) {
  await ensureDatabase();
  try {
    const [user] = await getDb()
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash: hashPassword(input.password),
      })
      .returning();
    await openSession(user.id);
  } catch (error) {
    if (isUniqueViolation(error)) throw new CommunityFlowError("이미 있는 이메일입니다.");
    throw error;
  }
}

export async function loginAccount(input: { email: string; password: string }) {
  await ensureDatabase();
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new CommunityFlowError("이메일 또는 비밀번호가 맞지 않습니다.");
  }
  await openSession(user.id);
  const [membership] = await db.select().from(members).where(eq(members.userId, user.id)).limit(1);
  if (membership) await rememberCommunity(membership.communityId);
}

export async function createCommunity(input: {
  name: string;
  churchName: string;
  denomination: string;
  slug: string;
  planTier: "FREE" | "PRO";
  requireApproval: boolean;
  languageMode: LanguageMode;
  customTermOverrides: CustomTermOverrides;
  phone: string | null;
}) {
  await ensureDatabase();
  const actor = await loadActor();
  assertCan(actor, { type: "create_community" });
  if (actor.kind !== "user") throw new CommunityFlowError("먼저 계정을 만들어 주세요.");
  const db = getDb();
  const [account] = await db.select().from(users).where(eq(users.id, actor.userId)).limit(1);
  if (!account) throw new CommunityFlowError("계정을 찾지 못했습니다.");

  try {
    const created = await db.transaction(async (tx) => {
      const [community] = await tx
        .insert(communities)
        .values({
          name: input.name,
          churchName: input.churchName,
          denomination: input.denomination,
          slug: input.slug,
          planTier: input.planTier,
          requireApproval: input.requireApproval,
          languageMode: input.languageMode,
          customTermOverrides: input.customTermOverrides,
        })
        .returning();
      await tx.insert(members).values({
        communityId: community.id,
        userId: actor.userId,
        name: account.name,
        phone: input.phone,
        role: "PASTOR",
        status: "ACTIVE",
      });
      return community;
    });
    await rememberCommunity(created.id);
  } catch (error) {
    if (isUniqueViolation(error)) throw new CommunityFlowError("이미 쓰는 주소 이름입니다. 다른 이름으로 적어 주세요.");
    throw error;
  }
}

export async function issueInvite(maxUses: number | null) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await communityForActor(actor);
  assertCan(actor, { type: "issue_invite", communityId });
  const membership = assertApprovedMember(actor, communityId);
  await getDb().insert(inviteCodes).values({
    communityId,
    code: makeInviteCode(),
    createdByMemberId: membership.memberId,
    maxUses,
  });
}

export async function applyToJoin(input: { code: string; denomination: string; phone: string; name: string }) {
  await ensureDatabase();
  const actor = await loadActor();
  assertCan(actor, { type: "apply_to_join" });
  if (actor.kind !== "user") throw new CommunityFlowError("가입 신청 전에 계정을 만들어 주세요.");

  const db = getDb();
  const [invite] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, input.code)).limit(1);
  const community = invite
    ? (await db.select().from(communities).where(eq(communities.id, invite.communityId)).limit(1))[0]
    : undefined;
  const alreadyMember = Boolean(
    community && actor.memberships.some((item) => item.communityId === community.id),
  );
  const alreadyPending = actor.pendingCommunityIds.includes(community?.id ?? "");
  const blocked = explainJoinBlock({
    codeFound: Boolean(invite && community),
    expired: Boolean(invite?.expiresAt && invite.expiresAt.getTime() < Date.now()),
    exhausted: Boolean(invite?.maxUses != null && invite.useCount >= invite.maxUses),
    denominationMatches: Boolean(community && denominationsMatch(input.denomination, community.denomination)),
    alreadyMember,
    alreadyPending,
  });
  if (blocked || !invite || !community) throw new CommunityFlowError(blocked ?? "가입 신청을 받지 못했습니다.");

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(inviteCodes)
      .set({
        useCount: sql`${inviteCodes.useCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inviteCodes.id, invite.id),
          sql`${inviteCodes.maxUses} is null or ${inviteCodes.useCount} < ${inviteCodes.maxUses}`,
        ),
      )
      .returning({ id: inviteCodes.id });
    if (updated.length === 0) throw new CommunityFlowError("초대 코드를 더 쓸 수 없습니다.");
    await tx.insert(approvalRequests).values({
      communityId: community.id,
      applicantUserId: actor.userId,
      applicantName: input.name,
      applicantContact: input.phone,
      denominationConfirmed: true,
      status: "PENDING",
    });
  });
}

export async function reviewApproval(requestId: string, decision: "APPROVED" | "REJECTED") {
  await ensureDatabase();
  const actor = await loadActor();
  const db = getDb();
  const [request] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, requestId)).limit(1);
  if (!request || request.status !== "PENDING") throw new CommunityFlowError("기다릴 신청이 없습니다.");
  assertCan(actor, { type: "review_approval", communityId: request.communityId });
  if (!request.applicantUserId) throw new CommunityFlowError("신청한 계정이 없습니다.");

  if (decision === "REJECTED") {
    await db
      .update(approvalRequests)
      .set({ status: "REJECTED", updatedAt: new Date() })
      .where(and(eq(approvalRequests.id, request.id), eq(approvalRequests.status, "PENDING")));
    return;
  }

  const roster = await db.select().from(members).where(eq(members.communityId, request.communityId));
  const plan = planApproval(
    roster.map((row) => ({ id: row.id, userId: row.userId, phone: row.phone })),
    request.applicantContact ?? "",
  );
  if (plan.kind === "ambiguous") {
    throw new CommunityFlowError("같은 전화번호의 미가입 명부가 여러 줄입니다. 교적에서 먼저 한 줄만 남겨 주세요.");
  }

  await db.transaction(async (tx) => {
    let memberId = "";
    if (plan.kind === "merge") {
      const updated = await tx
        .update(members)
        .set({ userId: request.applicantUserId, updatedAt: new Date() })
        .where(and(eq(members.id, plan.memberId), eq(members.communityId, request.communityId), isNull(members.userId)))
        .returning({ id: members.id });
      if (updated.length === 0) throw new CommunityFlowError("합칠 명부 줄을 찾지 못했습니다.");
      memberId = updated[0].id;
    } else {
      const [created] = await tx
        .insert(members)
        .values({
          communityId: request.communityId,
          userId: request.applicantUserId,
          name: request.applicantName,
          phone: request.applicantContact,
          role: "MEMBER",
          status: "ACTIVE",
        })
        .returning();
      memberId = created.id;
    }
    await tx
      .update(approvalRequests)
      .set({
        status: "APPROVED",
        memberId,
        denominationConfirmed: true,
        updatedAt: new Date(),
      })
      .where(and(eq(approvalRequests.id, request.id), eq(approvalRequests.status, "PENDING")));
  });
}

async function endOpenMembership(memberId: string, communityId: string) {
  await getDb()
    .update(groupMemberships)
    .set({ endedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(groupMemberships.memberId, memberId),
        eq(groupMemberships.communityId, communityId),
        isNull(groupMemberships.endedAt),
      ),
    );
}

async function openMembership(input: { communityId: string; groupId: string; memberId: string; seasonYear: number }) {
  await endOpenMembership(input.memberId, input.communityId);
  await getDb().insert(groupMemberships).values({
    communityId: input.communityId,
    groupId: input.groupId,
    memberId: input.memberId,
    seasonYear: input.seasonYear,
  });
  await getDb()
    .update(members)
    .set({ currentGroupId: input.groupId, updatedAt: new Date() })
    .where(and(eq(members.id, input.memberId), eq(members.communityId, input.communityId)));
}

export async function saveRosterMember(input: {
  memberId: string | null;
  name: string;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  role: MemberRole;
  status: "ACTIVE" | "LONG_ABSENT" | "GRADUATED";
  groupId: string | null;
}) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await communityForActor(actor);
  assertCan(actor, { type: "manage_roster", communityId });
  const db = getDb();

  if (input.groupId) {
    const [group] = await db.select().from(smallGroups).where(eq(smallGroups.id, input.groupId)).limit(1);
    if (!group) throw new CommunityFlowError("소속 모들을 찾지 못했습니다.");
    assertSameCommunity(communityId, group.communityId);
    if (group.isArchived) throw new CommunityFlowError("보관된 모들에는 새로 넣지 않습니다.");
  }

  if (!input.memberId) {
    const [created] = await db
      .insert(members)
      .values({
        communityId,
        userId: null,
        name: input.name,
        phone: input.phone,
        birthDate: input.birthDate,
        gender: input.gender,
        role: input.role,
        status: input.status,
        currentGroupId: null,
      })
      .returning();
    if (input.groupId) {
      const [group] = await db.select().from(smallGroups).where(eq(smallGroups.id, input.groupId)).limit(1);
      if (group) {
        await openMembership({
          communityId,
          groupId: group.id,
          memberId: created.id,
          seasonYear: group.seasonYear,
        });
      }
    }
    return;
  }

  const [existing] = await db.select().from(members).where(eq(members.id, input.memberId)).limit(1);
  if (!existing) throw new CommunityFlowError("명부에서 그 사람을 찾지 못했습니다.");
  assertSameCommunity(communityId, existing.communityId);
  await db
    .update(members)
    .set({
      name: input.name,
      phone: input.phone,
      birthDate: input.birthDate,
      gender: input.gender,
      role: input.role,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(and(eq(members.id, existing.id), eq(members.communityId, communityId)));

  if (input.groupId !== existing.currentGroupId) {
    if (!input.groupId) {
      await endOpenMembership(existing.id, communityId);
      await db
        .update(members)
        .set({ currentGroupId: null, updatedAt: new Date() })
        .where(eq(members.id, existing.id));
    } else {
      const [group] = await db.select().from(smallGroups).where(eq(smallGroups.id, input.groupId)).limit(1);
      if (!group || group.isArchived) throw new CommunityFlowError("보관된 모들에는 새로 넣지 않습니다.");
      await openMembership({
        communityId,
        groupId: group.id,
        memberId: existing.id,
        seasonYear: group.seasonYear,
      });
    }
  }
}

export async function startSeason(year: number) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await communityForActor(actor);
  assertCan(actor, { type: "manage_groups", communityId });
  const db = getDb();
  const groups = await db.select().from(smallGroups).where(eq(smallGroups.communityId, communityId));
  const archiveIds = groupIdsToArchive(groups, year);
  if (archiveIds.length > 0) {
    await db
      .update(smallGroups)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(and(eq(smallGroups.communityId, communityId), inArray(smallGroups.id, archiveIds)));
  }
}

export async function createGroup(input: { seasonYear: number; name: string; leaderMemberId: string | null }) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await communityForActor(actor);
  assertCan(actor, { type: "manage_groups", communityId });
  const db = getDb();
  if (input.leaderMemberId) {
    const [leader] = await db.select().from(members).where(eq(members.id, input.leaderMemberId)).limit(1);
    if (!leader) throw new CommunityFlowError("테우리로 지정할 사람을 찾지 못했습니다.");
    assertSameCommunity(communityId, leader.communityId);
  }
  const [group] = await db
    .insert(smallGroups)
    .values({
      communityId,
      seasonYear: input.seasonYear,
      name: input.name,
      leaderMemberId: input.leaderMemberId,
      isArchived: false,
    })
    .returning();
  if (input.leaderMemberId) {
    await openMembership({
      communityId,
      groupId: group.id,
      memberId: input.leaderMemberId,
      seasonYear: input.seasonYear,
    });
  }
}

export async function assignMemberToGroup(input: { groupId: string; memberId: string }) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await communityForActor(actor);
  assertCan(actor, { type: "manage_groups", communityId });
  const db = getDb();
  const [group] = await db.select().from(smallGroups).where(eq(smallGroups.id, input.groupId)).limit(1);
  const [member] = await db.select().from(members).where(eq(members.id, input.memberId)).limit(1);
  if (!group || !member) throw new CommunityFlowError("모들 또는 사람을 찾지 못했습니다.");
  assertSameCommunity(communityId, group.communityId);
  assertSameCommunity(communityId, member.communityId);
  if (group.isArchived) throw new CommunityFlowError("보관된 모들에는 새로 넣지 않습니다. 올해 모들을 만들어 주세요.");
  await openMembership({
    communityId,
    groupId: group.id,
    memberId: member.id,
    seasonYear: group.seasonYear,
  });
}

export type ShellState = {
  accountName: string | null;
  languageMode: LanguageMode | null;
  overridesJson: string;
};

export async function loadShellState(): Promise<ShellState> {
  try {
    await ensureDatabase();
    const actor = await loadActor();
    if (actor.kind !== "user") return { accountName: null, languageMode: null, overridesJson: "{}" };
    const accountName = await currentUserName(actor.userId);
    const communityId = await activeCommunityId(actor);
    if (!communityId) return { accountName, languageMode: null, overridesJson: "{}" };
    const [community] = await getDb().select().from(communities).where(eq(communities.id, communityId)).limit(1);
    if (!community) return { accountName, languageMode: null, overridesJson: "{}" };
    return {
      accountName,
      languageMode: community.languageMode,
      overridesJson: JSON.stringify(community.customTermOverrides ?? {}),
    };
  } catch {
    return { accountName: null, languageMode: null, overridesJson: "{}" };
  }
}

async function gate<T>(action: "manage_roster" | "issue_invite" | "review_approval" | "manage_groups", load: (communityId: string) => Promise<T>) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "이 일을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  try {
    assertCan(actor, { type: action, communityId });
  } catch (error) {
    return { ok: false as const, message: readableError(error) };
  }
  const [community] = await getDb().select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const data = await load(communityId);
  return { ok: true as const, community, data };
}

export async function loadRosterPage() {
  return gate("manage_roster", async (communityId) => {
    const db = getDb();
    const roster = await db.select().from(members).where(eq(members.communityId, communityId)).orderBy(asc(members.name));
    const groups = await db.select().from(smallGroups).where(eq(smallGroups.communityId, communityId)).orderBy(asc(smallGroups.name));
    return { roster, groups };
  });
}

export async function loadMemberForEdit(memberId: string) {
  const page = await loadRosterPage();
  if (!page.ok) return page;
  const member = page.data.roster.find((row) => row.id === memberId);
  if (!member) return { ok: false as const, message: "이 공동체 명부에 없는 사람입니다." };
  return { ok: true as const, community: page.community, member, groups: page.data.groups };
}

export async function loadInvitePage() {
  return gate("issue_invite", async (communityId) => {
    const codes = await getDb()
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.communityId, communityId))
      .orderBy(asc(inviteCodes.createdAt));
    return { codes };
  });
}

export async function loadApprovalPage() {
  return gate("review_approval", async (communityId) => {
    const requests = await getDb()
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.communityId, communityId))
      .orderBy(asc(approvalRequests.createdAt));
    return { requests };
  });
}

export async function loadGroupPage() {
  return gate("manage_groups", async (communityId) => {
    const db = getDb();
    const groups = await db.select().from(smallGroups).where(eq(smallGroups.communityId, communityId)).orderBy(asc(smallGroups.seasonYear));
    const roster = await db.select().from(members).where(eq(members.communityId, communityId)).orderBy(asc(members.name));
    const history = await db
      .select()
      .from(groupMemberships)
      .where(eq(groupMemberships.communityId, communityId))
      .orderBy(asc(groupMemberships.assignedAt));
    return { groups, roster, history };
  });
}

export async function loadAccountPage() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") return { user: null as null, pendingCount: 0 };
  return {
    user: { name: (await currentUserName(actor.userId)) ?? "" },
    pendingCount: actor.pendingCommunityIds.length,
  };
}
