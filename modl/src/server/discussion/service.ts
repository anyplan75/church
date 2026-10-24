/**
 * 토론 글과 답글을 저장합니다.
 * 교회 글과 모들 글은 그곳에 속한 사람만 봅니다.
 * 서귀포시, 제주시, 제주도, 전체 교회는 로그인한 사람이 보고, 익명을 고르면 이름을 내리지 않습니다.
 */

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  canSeeDiscussionPost,
  discussionScopeFromRef,
  isBroadDiscussionScope,
  resolvedDiscussionScope,
  visibleAuthorName,
  type DiscussionScope,
  type DiscussionScopeKind,
} from "@/discussion/rules";
import { BannedWordError, assertTextsAllowed } from "@/server/moderation/guard";
import { loadActor } from "@/server/auth/session";
import { discussionPosts, discussionReplies, mapChurches, smallGroups, users } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { loadPlaceScope } from "@/server/place/service";

export class DiscussionFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscussionFlowError";
  }
}

export function readableDiscussionError(error: unknown): string {
  if (error instanceof DiscussionFlowError || error instanceof BannedWordError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "토론 글을 처리하지 못했습니다.";
}

export type DiscussionScopeChoice = DiscussionScope & { label: string };

const REGION_CHOICES: DiscussionScopeChoice[] = [
  { kind: "seogwipo", id: "seogwipo", label: "서귀포시" },
  { kind: "jeju_city", id: "jeju_city", label: "제주시" },
  { kind: "jeju", id: "jeju", label: "제주도" },
];

const SCOPE_LABEL: Record<DiscussionScopeKind, string> = {
  seogwipo: "서귀포시",
  jeju_city: "제주시",
  jeju: "제주도",
  church: "교회",
  gathering: "모들",
  all: "전체 교회",
};

async function viewerScopes() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") return { ok: false as const };
  const scope = await loadPlaceScope(actor.userId);
  const db = getDb();
  const churchRows = scope.churchIds.size
    ? await db.select({ id: mapChurches.id, name: mapChurches.name }).from(mapChurches).where(inArray(mapChurches.id, [...scope.churchIds]))
    : [];
  const groupRows = scope.groupIds.size
    ? await db.select({ id: smallGroups.id, name: smallGroups.name }).from(smallGroups).where(inArray(smallGroups.id, [...scope.groupIds]))
    : [];
  const churches = churchRows
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "ko"))
    .map((row) => ({ kind: "church" as const, id: row.id, label: row.name }));
  const gatherings = groupRows
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "ko"))
    .map((row) => ({ kind: "gathering" as const, id: row.id, label: row.name }));
  const scopes: DiscussionScopeChoice[] = [...REGION_CHOICES, ...churches, ...gatherings, { kind: "all", id: "all", label: "전체 교회" }];
  return { ok: true as const, userId: actor.userId, scopes, churchIds: scope.churchIds, groupIds: scope.groupIds };
}

function placeLabelFor(
  post: { scope?: string | null; churchId: string | null; groupId: string | null; isJeju?: boolean },
  scopes: readonly DiscussionScopeChoice[],
): string {
  const kind = resolvedDiscussionScope(post);
  if (kind === "church" || kind === "gathering") {
    const found = scopes.find((scope) => scope.kind === kind && scope.id === (kind === "church" ? post.churchId : post.groupId));
    return found?.label ?? SCOPE_LABEL[kind];
  }
  if (kind) return SCOPE_LABEL[kind];
  return "";
}

export async function loadDiscussionBoard(scopeRef = "") {
  const viewer = await viewerScopes();
  if (!viewer.ok) return { ok: false as const };
  const selected = discussionScopeFromRef(scopeRef, viewer.scopes) ?? viewer.scopes[0] ?? null;
  const db = getDb();
  const churchIds = [...viewer.churchIds];
  const groupIds = [...viewer.groupIds];
  const filters = [
    inArray(discussionPosts.scope, ["seogwipo", "jeju_city", "jeju", "all"]),
    eq(discussionPosts.isJeju, true),
    churchIds.length ? and(inArray(discussionPosts.churchId, churchIds), isNull(discussionPosts.groupId)) : undefined,
    groupIds.length ? and(inArray(discussionPosts.groupId, groupIds), isNull(discussionPosts.churchId)) : undefined,
  ].filter((item) => item !== undefined);
  const where = filters.length === 1 ? filters[0] : or(...filters);
  const rows = await db
    .select({
      id: discussionPosts.id,
      title: discussionPosts.title,
      body: discussionPosts.body,
      churchId: discussionPosts.churchId,
      groupId: discussionPosts.groupId,
      isJeju: discussionPosts.isJeju,
      scope: discussionPosts.scope,
      anonymous: discussionPosts.anonymous,
      authorName: users.name,
      createdAt: discussionPosts.createdAt,
    })
    .from(discussionPosts)
    .innerJoin(users, eq(users.id, discussionPosts.authorUserId))
    .where(where)
    .orderBy(desc(discussionPosts.createdAt));
  const viewerSets = { churchIds: viewer.churchIds, groupIds: viewer.groupIds };
  const visible = rows.filter((row) => {
    if (!canSeeDiscussionPost(row, viewerSets)) return false;
    if (!selected) return true;
    if (resolvedDiscussionScope(row) !== selected.kind) return false;
    if (selected.kind === "church") return row.churchId === selected.id;
    if (selected.kind === "gathering") return row.groupId === selected.id;
    return true;
  });
  const ids = visible.map((row) => row.id);
  const counts = ids.length
    ? await db
        .select({
          postId: discussionReplies.postId,
          total: sql<number>`cast(count(*) as int)`,
        })
        .from(discussionReplies)
        .where(inArray(discussionReplies.postId, ids))
        .groupBy(discussionReplies.postId)
    : [];
  const countByPost = new Map(counts.map((row) => [row.postId, Number(row.total)]));
  return {
    ok: true as const,
    scopes: viewer.scopes,
    selected,
    posts: visible.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      authorName: visibleAuthorName({ anonymous: row.anonymous, name: row.authorName }),
      placeLabel: placeLabelFor(row, viewer.scopes),
      replyCount: countByPost.get(row.id) ?? 0,
      createdAt: row.createdAt,
    })),
  };
}

export async function loadDiscussionPost(postId: string) {
  const viewer = await viewerScopes();
  if (!viewer.ok) return { ok: false as const, reason: "guest" as const };
  const db = getDb();
  const [row] = await db
    .select({
      id: discussionPosts.id,
      title: discussionPosts.title,
      body: discussionPosts.body,
      churchId: discussionPosts.churchId,
      groupId: discussionPosts.groupId,
      isJeju: discussionPosts.isJeju,
      scope: discussionPosts.scope,
      anonymous: discussionPosts.anonymous,
      authorName: users.name,
      createdAt: discussionPosts.createdAt,
    })
    .from(discussionPosts)
    .innerJoin(users, eq(users.id, discussionPosts.authorUserId))
    .where(eq(discussionPosts.id, postId))
    .limit(1);
  if (!row || !canSeeDiscussionPost(row, { churchIds: viewer.churchIds, groupIds: viewer.groupIds })) {
    return { ok: false as const, reason: "hidden" as const };
  }
  const replies = await db
    .select({
      id: discussionReplies.id,
      body: discussionReplies.body,
      anonymous: discussionReplies.anonymous,
      authorName: users.name,
      createdAt: discussionReplies.createdAt,
    })
    .from(discussionReplies)
    .innerJoin(users, eq(users.id, discussionReplies.authorUserId))
    .where(eq(discussionReplies.postId, row.id))
    .orderBy(asc(discussionReplies.createdAt));
  const kind = resolvedDiscussionScope(row);
  return {
    ok: true as const,
    post: {
      id: row.id,
      title: row.title,
      body: row.body,
      authorName: visibleAuthorName({ anonymous: row.anonymous, name: row.authorName }),
      placeLabel: placeLabelFor(row, viewer.scopes),
      isJeju: row.isJeju,
      broad: isBroadDiscussionScope(kind),
      createdAt: row.createdAt,
    },
    replies: replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      authorName: visibleAuthorName({ anonymous: reply.anonymous, name: reply.authorName }),
      createdAt: reply.createdAt,
    })),
  };
}

export async function createDiscussionPost(input: { title: string; body: string; placeRef: string; anonymous: boolean }): Promise<string> {
  const viewer = await viewerScopes();
  if (!viewer.ok) throw new DiscussionFlowError("글을 쓰려면 먼저 들어가 주세요.");
  const place = discussionScopeFromRef(input.placeRef, viewer.scopes);
  if (!place) throw new DiscussionFlowError("글을 올릴 범위를 골라 주세요.");
  await assertTextsAllowed(input.title, input.body);
  const broad = isBroadDiscussionScope(place.kind);
  const [created] = await getDb()
    .insert(discussionPosts)
    .values({
      churchId: place.kind === "church" ? place.id : null,
      groupId: place.kind === "gathering" ? place.id : null,
      isJeju: place.kind === "jeju",
      scope: place.kind,
      anonymous: broad && input.anonymous,
      authorUserId: viewer.userId,
      title: input.title,
      body: input.body,
    })
    .returning({ id: discussionPosts.id });
  if (!created) throw new DiscussionFlowError("글을 저장하지 못했습니다.");
  return created.id;
}

export async function createDiscussionReply(input: { postId: string; body: string; anonymous: boolean }): Promise<void> {
  const viewer = await viewerScopes();
  if (!viewer.ok) throw new DiscussionFlowError("답글을 쓰려면 먼저 들어가 주세요.");
  const db = getDb();
  const [row] = await db
    .select({
      id: discussionPosts.id,
      churchId: discussionPosts.churchId,
      groupId: discussionPosts.groupId,
      isJeju: discussionPosts.isJeju,
      scope: discussionPosts.scope,
    })
    .from(discussionPosts)
    .where(eq(discussionPosts.id, input.postId))
    .limit(1);
  if (!row || !canSeeDiscussionPost(row, { churchIds: viewer.churchIds, groupIds: viewer.groupIds })) {
    throw new DiscussionFlowError("이 글에는 답글을 달 수 없습니다.");
  }
  await assertTextsAllowed(input.body);
  const broad = isBroadDiscussionScope(resolvedDiscussionScope(row));
  await db.insert(discussionReplies).values({
    postId: row.id,
    authorUserId: viewer.userId,
    anonymous: broad && input.anonymous,
    body: input.body,
  });
}
