/**
 * 교회·모들 게시판을 읽고 저장합니다.
 * 그곳을 구독한 구성원만 글을 쓰고, 본인 글만 고치거나 지웁니다.
 * 안내 승인과는 따로 둡니다.
 */

import { and, desc, eq, isNull } from "drizzle-orm";
import { cleanBoardPost, memberCanWrite, type BoardPlaceKind } from "@/board/rules";
import { BannedWordError, assertTextsAllowed } from "@/server/moderation/guard";
import { loadActor } from "@/server/auth/session";
import { mapChurches, placeBoardPosts, smallGroups, users } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { loadPlaceScope } from "@/server/place/service";

export class BoardFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardFlowError";
  }
}

export function readableBoardError(error: unknown): string {
  if (error instanceof BoardFlowError || error instanceof BannedWordError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "게시판 글을 처리하지 못했습니다.";
}

export type BoardListItem = {
  id: string;
  title: string;
  authorName: string;
  createdLabel: string;
  mine: boolean;
};

export type BoardPostView = BoardListItem & {
  body: string;
  placeName: string;
};

function writtenAt(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function placeColumn(kind: BoardPlaceKind) {
  return kind === "church" ? placeBoardPosts.churchId : placeBoardPosts.groupId;
}

async function placeName(kind: BoardPlaceKind, id: string): Promise<string | null> {
  const db = getDb();
  if (kind === "church") {
    const [row] = await db.select({ name: mapChurches.name }).from(mapChurches).where(eq(mapChurches.id, id)).limit(1);
    return row?.name ?? null;
  }
  const [row] = await db.select({ name: smallGroups.name }).from(smallGroups).where(eq(smallGroups.id, id)).limit(1);
  return row?.name ?? null;
}

async function writer(kind: BoardPlaceKind, id: string): Promise<{ userId: string }> {
  const actor = await loadActor();
  if (actor.kind !== "user") throw new BoardFlowError("먼저 들어가 주세요.");
  const scope = await loadPlaceScope(actor.userId);
  if (!memberCanWrite(kind, id, scope.churchIds, scope.groupIds)) {
    throw new BoardFlowError(kind === "church" ? "이 교회 구성원만 글을 쓸 수 있습니다." : "이 모들 구성원만 글을 쓸 수 있습니다.");
  }
  return { userId: actor.userId };
}

export async function loadPlaceBoard(
  kind: BoardPlaceKind,
  id: string,
): Promise<{ canWrite: boolean; viewer: "guest" | "member" | "other"; posts: BoardListItem[] } | null> {
  await ensureDatabase();
  const name = await placeName(kind, id);
  if (!name) return null;
  const actor = await loadActor();
  let canWrite = false;
  let viewer: "guest" | "member" | "other" = "guest";
  if (actor.kind === "user") {
    const scope = await loadPlaceScope(actor.userId);
    canWrite = memberCanWrite(kind, id, scope.churchIds, scope.groupIds);
    viewer = canWrite ? "member" : "other";
  }
  const db = getDb();
  const rows = await db
    .select({
      id: placeBoardPosts.id,
      title: placeBoardPosts.title,
      authorUserId: placeBoardPosts.authorUserId,
      authorName: users.name,
      createdAt: placeBoardPosts.createdAt,
    })
    .from(placeBoardPosts)
    .innerJoin(users, eq(users.id, placeBoardPosts.authorUserId))
    .where(and(eq(placeColumn(kind), id), kind === "church" ? isNull(placeBoardPosts.groupId) : isNull(placeBoardPosts.churchId)))
    .orderBy(desc(placeBoardPosts.createdAt))
    .limit(80);
  return {
    canWrite,
    viewer,
    posts: rows.map((row) => ({
      id: row.id,
      title: row.title,
      authorName: row.authorName,
      createdLabel: writtenAt(row.createdAt),
      mine: actor.kind === "user" && row.authorUserId === actor.userId,
    })),
  };
}

export async function loadPlaceBoardPost(kind: BoardPlaceKind, placeId: string, postId: string): Promise<BoardPostView | null> {
  const board = await loadPlaceBoard(kind, placeId);
  if (!board) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: placeBoardPosts.id,
      title: placeBoardPosts.title,
      body: placeBoardPosts.body,
      authorUserId: placeBoardPosts.authorUserId,
      authorName: users.name,
      createdAt: placeBoardPosts.createdAt,
    })
    .from(placeBoardPosts)
    .innerJoin(users, eq(users.id, placeBoardPosts.authorUserId))
    .where(
      and(
        eq(placeBoardPosts.id, postId),
        eq(placeColumn(kind), placeId),
        kind === "church" ? isNull(placeBoardPosts.groupId) : isNull(placeBoardPosts.churchId),
      ),
    )
    .limit(1);
  if (!row) return null;
  const name = await placeName(kind, placeId);
  const actor = await loadActor();
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    authorName: row.authorName,
    createdLabel: writtenAt(row.createdAt),
    mine: actor.kind === "user" && row.authorUserId === actor.userId,
    placeName: name ?? "",
  };
}

export async function createPlaceBoardPost(kind: BoardPlaceKind, id: string, title: string, body: string): Promise<string> {
  await ensureDatabase();
  if (!(await placeName(kind, id))) throw new BoardFlowError(kind === "church" ? "교회를 찾지 못했습니다." : "모들을 찾지 못했습니다.");
  const cleaned = cleanBoardPost(title, body);
  if (!cleaned.ok) throw new BoardFlowError(cleaned.message);
  const { userId } = await writer(kind, id);
  await assertTextsAllowed(cleaned.title, cleaned.body);
  const db = getDb();
  const [row] = await db
    .insert(placeBoardPosts)
    .values({
      churchId: kind === "church" ? id : null,
      groupId: kind === "gathering" ? id : null,
      authorUserId: userId,
      title: cleaned.title,
      body: cleaned.body,
    })
    .returning({ id: placeBoardPosts.id });
  if (!row) throw new BoardFlowError("글을 올리지 못했습니다.");
  return row.id;
}

async function ownPost(kind: BoardPlaceKind, placeId: string, postId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: placeBoardPosts.id, authorUserId: placeBoardPosts.authorUserId })
    .from(placeBoardPosts)
    .where(
      and(
        eq(placeBoardPosts.id, postId),
        eq(placeColumn(kind), placeId),
        kind === "church" ? isNull(placeBoardPosts.groupId) : isNull(placeBoardPosts.churchId),
      ),
    )
    .limit(1);
  if (!row) throw new BoardFlowError("글을 찾지 못했습니다.");
  if (row.authorUserId !== userId) throw new BoardFlowError("내가 쓴 글만 고치거나 지울 수 있습니다.");
  return row;
}

export async function updatePlaceBoardPost(kind: BoardPlaceKind, placeId: string, postId: string, title: string, body: string): Promise<void> {
  await ensureDatabase();
  const cleaned = cleanBoardPost(title, body);
  if (!cleaned.ok) throw new BoardFlowError(cleaned.message);
  const { userId } = await writer(kind, placeId);
  await ownPost(kind, placeId, postId, userId);
  await assertTextsAllowed(cleaned.title, cleaned.body);
  const db = getDb();
  await db
    .update(placeBoardPosts)
    .set({ title: cleaned.title, body: cleaned.body, updatedAt: new Date() })
    .where(eq(placeBoardPosts.id, postId));
}

export async function deletePlaceBoardPost(kind: BoardPlaceKind, placeId: string, postId: string): Promise<void> {
  await ensureDatabase();
  const { userId } = await writer(kind, placeId);
  await ownPost(kind, placeId, postId, userId);
  const db = getDb();
  await db.delete(placeBoardPosts).where(eq(placeBoardPosts.id, postId));
}
