/**
 * 토론 글과 답글을 저장합니다.
 * 교회 글과 모들 글은 지금 그곳인 사람만 봅니다.
 * 제주 전체 글은 로그인한 사람이 보고, 익명을 고르면 이름을 내리지 않습니다.
 */

import { asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { canSeeDiscussionPost, discussionPlaceFromRef, discussionPlacesFor, visibleAuthorName, type DiscussionPlace } from "@/discussion/rules";
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

export type DiscussionPlaceChoice = DiscussionPlace & { label: string };

export type DiscussionPostItem = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  placeLabel: string;
  replyCount: number;
  createdAt: Date;
};

export type DiscussionReplyItem = {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
};

async function namedPlaces(places: readonly DiscussionPlace[]): Promise<DiscussionPlaceChoice[]> {
  const db = getDb();
  const churchIds = places.filter((place) => place.kind === "church").map((place) => place.id);
  const groupIds = places.filter((place) => place.kind === "gathering").map((place) => place.id);
  const churchRows = churchIds.length
    ? await db.select({ id: mapChurches.id, name: mapChurches.name }).from(mapChurches).where(inArray(mapChurches.id, churchIds))
    : [];
  const groupRows = groupIds.length
    ? await db.select({ id: smallGroups.id, name: smallGroups.name }).from(smallGroups).where(inArray(smallGroups.id, groupIds))
    : [];
  const churchNames = new Map(churchRows.map((row) => [row.id, row.name]));
  const groupNames = new Map(groupRows.map((row) => [row.id, row.name]));
  return places.map((place) => {
    if (place.kind === "jeju") return { ...place, label: "제주 전체" };
    const name = place.kind === "church" ? churchNames.get(place.id) : groupNames.get(place.id);
    const kindLabel = place.kind === "church" ? "교회" : "모들";
    return { ...place, label: name ? `${kindLabel} · ${name}` : kindLabel };
  });
}

async function viewerPlaces() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") return { ok: false as const };
  const scope = await loadPlaceScope(actor.userId);
  const places = await namedPlaces([
    ...discussionPlacesFor({
      currentChurchId: scope.currentChurchId,
      currentGroupId: scope.currentGroupId,
      followedChurchIds: scope.churchIds,
      followedGroupIds: scope.groupIds,
    }),
    { kind: "jeju", id: "jeju" },
  ]);
  return { ok: true as const, userId: actor.userId, places };
}

function placeLabelFor(
  post: { churchId: string | null; groupId: string | null; isJeju?: boolean },
  places: readonly DiscussionPlaceChoice[],
): string {
  if (post.isJeju) return "제주 전체";
  const found = places.find((place) => (place.kind === "church" ? place.id === post.churchId : place.kind === "gathering" && place.id === post.groupId));
  return found?.label ?? (post.churchId ? "교회" : "모들");
}

export async function loadDiscussionBoard() {
  const viewer = await viewerPlaces();
  if (!viewer.ok) return { ok: false as const };
  const db = getDb();
  const churchIds = viewer.places.filter((place) => place.kind === "church").map((place) => place.id);
  const groupIds = viewer.places.filter((place) => place.kind === "gathering").map((place) => place.id);
  const filters = [
    eq(discussionPosts.isJeju, true),
    churchIds.length ? inArray(discussionPosts.churchId, churchIds) : undefined,
    groupIds.length ? inArray(discussionPosts.groupId, groupIds) : undefined,
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
      anonymous: discussionPosts.anonymous,
      authorName: users.name,
      createdAt: discussionPosts.createdAt,
    })
    .from(discussionPosts)
    .innerJoin(users, eq(users.id, discussionPosts.authorUserId))
    .where(where)
    .orderBy(desc(discussionPosts.createdAt));
  const visible = rows.filter((row) => canSeeDiscussionPost(row, viewer.places));
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
    places: viewer.places,
    posts: visible.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      authorName: visibleAuthorName({ anonymous: row.anonymous, name: row.authorName }),
      placeLabel: placeLabelFor(row, viewer.places),
      replyCount: countByPost.get(row.id) ?? 0,
      createdAt: row.createdAt,
    })),
  };
}

export async function loadDiscussionPost(postId: string) {
  const viewer = await viewerPlaces();
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
      anonymous: discussionPosts.anonymous,
      authorName: users.name,
      createdAt: discussionPosts.createdAt,
    })
    .from(discussionPosts)
    .innerJoin(users, eq(users.id, discussionPosts.authorUserId))
    .where(eq(discussionPosts.id, postId))
    .limit(1);
  if (!row || !canSeeDiscussionPost(row, viewer.places)) {
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
  return {
    ok: true as const,
    places: viewer.places,
    post: {
      id: row.id,
      title: row.title,
      body: row.body,
      authorName: visibleAuthorName({ anonymous: row.anonymous, name: row.authorName }),
      placeLabel: placeLabelFor(row, viewer.places),
      isJeju: row.isJeju,
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
  const viewer = await viewerPlaces();
  if (!viewer.ok) throw new DiscussionFlowError("글을 쓰려면 먼저 들어가 주세요.");
  const place = discussionPlaceFromRef(input.placeRef, viewer.places);
  if (!place) throw new DiscussionFlowError("글을 올릴 곳을 골라 주세요.");
  await assertTextsAllowed(input.title, input.body);
  const jeju = place.kind === "jeju";
  const [created] = await getDb()
    .insert(discussionPosts)
    .values({
      churchId: place.kind === "church" ? place.id : null,
      groupId: place.kind === "gathering" ? place.id : null,
      isJeju: jeju,
      anonymous: jeju && input.anonymous,
      authorUserId: viewer.userId,
      title: input.title,
      body: input.body,
    })
    .returning({ id: discussionPosts.id });
  if (!created) throw new DiscussionFlowError("글을 저장하지 못했습니다.");
  return created.id;
}

export async function createDiscussionReply(input: { postId: string; body: string; anonymous: boolean }): Promise<void> {
  const viewer = await viewerPlaces();
  if (!viewer.ok) throw new DiscussionFlowError("답글을 쓰려면 먼저 들어가 주세요.");
  const db = getDb();
  const [row] = await db
    .select({ id: discussionPosts.id, churchId: discussionPosts.churchId, groupId: discussionPosts.groupId, isJeju: discussionPosts.isJeju })
    .from(discussionPosts)
    .where(eq(discussionPosts.id, input.postId))
    .limit(1);
  if (!row || !canSeeDiscussionPost(row, viewer.places)) {
    throw new DiscussionFlowError("이 글에는 답글을 달 수 없습니다.");
  }
  await assertTextsAllowed(input.body);
  await db.insert(discussionReplies).values({
    postId: row.id,
    authorUserId: viewer.userId,
    anonymous: row.isJeju && input.anonymous,
    body: input.body,
  });
}
