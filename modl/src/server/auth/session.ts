/**
 * 로그인 표식을 쿠키와 sessions 표에 나눕니다.
 * 쿠키에는 표식 원문, 표에는 해시만 둡니다.
 */

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, inArray } from "drizzle-orm";
import type { Actor, Membership } from "@/server/auth/actor";
import { approvalRequests, members, sessions, smallGroups, users } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";

const SESSION_COOKIE = "modl_session";
const COMMUNITY_COOKIE = "modl_community";
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function openSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
  await getDb().insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function closeSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function rememberCommunity(communityId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COMMUNITY_COOKIE, communityId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function loadActor(): Promise<Actor> {
  await ensureDatabase();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "guest" };

  const db = getDb();
  const found = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const userId = found[0]?.userId;
  if (!userId) return { kind: "guest" };

  const memberRows = await db.select().from(members).where(eq(members.userId, userId));
  const memberIds = memberRows.map((row) => row.id);
  const led = memberIds.length
    ? await db.select().from(smallGroups).where(inArray(smallGroups.leaderMemberId, memberIds))
    : [];
  const pending = await db
    .select({ communityId: approvalRequests.communityId })
    .from(approvalRequests)
    .where(and(eq(approvalRequests.applicantUserId, userId), eq(approvalRequests.status, "PENDING")));

  const memberships: Membership[] = memberRows.map((row) => ({
    communityId: row.communityId,
    memberId: row.id,
    role: row.role,
    cohort: row.cohort,
    currentGroupId: row.currentGroupId,
    leaderGroupIds: led.filter((group) => group.leaderMemberId === row.id).map((group) => group.id),
  }));

  return {
    kind: "user",
    userId,
    memberships,
    pendingCommunityIds: pending.map((row) => row.communityId),
  };
}

export async function activeCommunityId(actor: Actor): Promise<string | null> {
  if (actor.kind !== "user" || actor.memberships.length === 0) return null;
  const jar = await cookies();
  const chosen = jar.get(COMMUNITY_COOKIE)?.value;
  if (chosen && actor.memberships.some((item) => item.communityId === chosen)) return chosen;
  return actor.memberships[0].communityId;
}

export async function currentUserName(userId: string): Promise<string | null> {
  const rows = await getDb().select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.name ?? null;
}
