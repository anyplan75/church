/**
 * 행사 기록과 퀴즈를 저장합니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 줄은 섞지 않습니다.
 * 퀴즈를 푸는 응답에는 정답 번호를 넣지 않습니다.
 */

import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  archiveScopeLabel,
  archiveTargets,
  canSeeArchive,
  linkLines,
  monthKey,
  parseQuizLines,
  pickQuizKing,
  publicQuizQuestions,
  quizWindow,
  replaceMemberScore,
  scoreQuiz,
  youtubeEmbedUrl,
  type QuizQuestion,
  type QuizScore,
} from "@/archive/rules";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertSameCommunity, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, eventArchives, mapChurches, members, quizMonthPrizes, quizzes, smallGroups } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";
import { loadPlaceScope } from "@/server/place/service";

export class ArchiveFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveFlowError";
  }
}

export function readableArchiveError(error: unknown): string {
  if (error instanceof ArchiveFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "기록을 처리하지 못했습니다.";
}

const questionSchema = z.object({
  prompt: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2),
  answerIndex: z.number().int().nonnegative(),
});

const scoreSchema = z.object({
  memberId: z.string().uuid(),
  score: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  submittedAt: z.string(),
});

function seoulDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function httpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function readQuestions(value: unknown): QuizQuestion[] {
  const parsed = z.array(questionSchema).safeParse(value);
  if (!parsed.success) throw new ArchiveFlowError("퀴즈 문제를 읽지 못했습니다.");
  for (const question of parsed.data) {
    if (question.answerIndex >= question.choices.length) {
      throw new ArchiveFlowError("퀴즈 문제를 읽지 못했습니다.");
    }
  }
  return parsed.data;
}

function readScores(value: unknown): QuizScore[] {
  const parsed = z.array(scoreSchema).safeParse(value ?? []);
  if (!parsed.success) return [];
  return parsed.data;
}

async function requireCommunity(actor: Actor): Promise<string> {
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    throw new ArchiveFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  }
  return communityId;
}

async function requireMember(actor: Actor, communityId: string) {
  assertApprovedMember(actor, communityId);
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    throw new ArchiveFlowError("승인 대기 중이거나 이 공동체 구성원이 아니어서 기록을 볼 수 없습니다.");
  }
  return membership;
}

export async function loadArchiveHome() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "기록을 보려면 먼저 들어가 주세요." };
  }
  const scope = await loadPlaceScope(actor.userId);
  const db = getDb();
  const churchIdList = [...scope.churchIds];
  const groupIdList = [...scope.groupIds];
  const churchRows = churchIdList.length
    ? await db.select({ id: mapChurches.id, name: mapChurches.name }).from(mapChurches).where(inArray(mapChurches.id, churchIdList)).orderBy(asc(mapChurches.name))
    : [];
  const gatheringRows = groupIdList.length
    ? await db
        .select({ id: smallGroups.id, name: smallGroups.name })
        .from(smallGroups)
        .where(and(inArray(smallGroups.id, groupIdList), eq(smallGroups.isArchived, false)))
        .orderBy(asc(smallGroups.name))
    : [];
  const churches = [...churchRows].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const gatherings = [...gatheringRows].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const filters = [
    churchIdList.length > 0 ? inArray(eventArchives.churchId, churchIdList) : undefined,
    groupIdList.length > 0 ? inArray(eventArchives.groupId, groupIdList) : undefined,
  ].filter((item) => item !== undefined);
  const where = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : or(...filters);
  const rows = where
    ? await db
        .select()
        .from(eventArchives)
        .where(where)
        .orderBy(sql`${eventArchives.eventDate} desc nulls last`, desc(eventArchives.createdAt))
    : [];
  const visible = rows.filter((row) => canSeeArchive(row, scope.churchIds, scope.groupIds));
  const nameChurchIds = [...new Set(visible.flatMap((row) => (row.churchId ? [row.churchId] : [])))];
  const nameGroupIds = [...new Set(visible.flatMap((row) => (row.groupId ? [row.groupId] : [])))];
  const namedChurches = nameChurchIds.length
    ? await db.select({ id: mapChurches.id, name: mapChurches.name }).from(mapChurches).where(inArray(mapChurches.id, nameChurchIds))
    : [];
  const namedGroups = nameGroupIds.length
    ? await db.select({ id: smallGroups.id, name: smallGroups.name }).from(smallGroups).where(inArray(smallGroups.id, nameGroupIds))
    : [];
  const churchNames = new Map(namedChurches.map((row) => [row.id, row.name]));
  const groupNames = new Map(namedGroups.map((row) => [row.id, row.name]));
  let canUpload = false;
  let communityName: string | null = null;
  const communityId = await activeCommunityId(actor);
  if (communityId) {
    const membership = formalMembership(actor, communityId);
    canUpload = membership?.role === "PASTOR";
    const [community] = await db.select({ name: communities.name }).from(communities).where(eq(communities.id, communityId)).limit(1);
    communityName = community?.name ?? null;
  }
  return {
    ok: true as const,
    communityName,
    canUpload,
    churches,
    gatherings,
    events: visible.map((event) => ({
      id: event.id,
      title: event.title,
      eventDate: event.eventDate ?? "",
      scopeLabel: archiveScopeLabel({
        churchName: event.churchId ? churchNames.get(event.churchId) ?? null : null,
        gatheringName: event.groupId ? groupNames.get(event.groupId) ?? null : null,
      }),
      materials: materialLinks(event.photoUrls, event.youtubeUrls),
    })),
  };
}

function materialLinks(photos: unknown, videos: unknown): string[] {
  const links: string[] = [];
  if (Array.isArray(photos)) {
    for (const item of photos) {
      if (typeof item === "string" && httpUrl(item)) links.push(item);
    }
  }
  if (Array.isArray(videos)) {
    for (const item of videos) {
      if (typeof item === "string" && youtubeEmbedUrl(item)) links.push(item.trim());
    }
  }
  return links;
}

function assertPastor(actor: Actor, communityId: string) {
  const membership = formalMembership(actor, communityId);
  if (!membership || membership.role !== "PASTOR") {
    throw new ArchiveFlowError("이 일은 사역자만 합니다.");
  }
}

export async function createArchive(input: {
  title: string;
  eventDate: string;
  photoText: string;
  youtubeText: string;
  churchIds: string[];
  gatheringIds: string[];
}): Promise<string> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") throw new ArchiveFlowError("기록을 보려면 먼저 들어가 주세요.");
  const communityId = await requireCommunity(actor);
  await requireMember(actor, communityId);
  assertPastor(actor, communityId);
  const scope = await loadPlaceScope(actor.userId);
  const target = archiveTargets({
    churchIds: input.churchIds,
    gatheringIds: input.gatheringIds,
    allowedChurchIds: scope.churchIds,
    allowedGatheringIds: new Set(
      scope.groupIds.size
        ? (
            await getDb()
              .select({ id: smallGroups.id })
              .from(smallGroups)
              .where(and(inArray(smallGroups.id, [...scope.groupIds]), eq(smallGroups.isArchived, false)))
          ).map((row) => row.id)
        : [],
    ),
  });
  if (!target.ok) throw new ArchiveFlowError(target.message);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)) {
    throw new ArchiveFlowError("행사 날짜를 확인해 주세요.");
  }
  const photoUrls = linkLines(input.photoText);
  for (const photoUrl of photoUrls) {
    if (!httpUrl(photoUrl)) throw new ArchiveFlowError("사진 주소는 http 또는 https 로 시작해 주세요.");
  }
  const youtubeUrls = linkLines(input.youtubeText);
  for (const youtubeUrl of youtubeUrls) {
    if (!youtubeEmbedUrl(youtubeUrl)) throw new ArchiveFlowError("유튜브 주소만 영상으로 넣을 수 있습니다.");
  }
  await assertTextsAllowed(input.title, input.photoText, input.youtubeText);
  const db = getDb();
  const created = await db
    .insert(eventArchives)
    .values(
      target.places.map((place) => ({
        communityId,
        churchId: place.churchId,
        groupId: place.groupId,
        title: input.title.trim(),
        eventDate: input.eventDate,
        photoUrls,
        youtubeUrls,
      })),
    )
    .returning({ id: eventArchives.id });
  const first = created[0];
  if (!first) throw new ArchiveFlowError("행사 기록을 저장하지 못했습니다.");
  return first.id;
}

export async function loadArchiveDetail(archiveId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "기록을 보려면 먼저 들어가 주세요." };
  }
  const scope = await loadPlaceScope(actor.userId);
  const db = getDb();
  const [row] = await db.select().from(eventArchives).where(eq(eventArchives.id, archiveId)).limit(1);
  if (!row) return { ok: false as const, message: "행사 기록을 찾지 못했습니다." };
  if (!canSeeArchive(row, scope.churchIds, scope.groupIds)) {
    return { ok: false as const, message: "구독한 교회나 모들의 행사자료만 봅니다." };
  }
  const photos = Array.isArray(row.photoUrls) ? row.photoUrls.filter((item) => typeof item === "string" && httpUrl(item)) : [];
  const videos = Array.isArray(row.youtubeUrls)
    ? row.youtubeUrls
        .filter((item): item is string => typeof item === "string")
        .map((item) => youtubeEmbedUrl(item))
        .filter((item): item is string => Boolean(item))
    : [];
  return {
    ok: true as const,
    archive: {
      id: row.id,
      title: row.title,
      photos,
      videos,
    },
  };
}

export async function createQuiz(input: {
  title: string;
  lines: string;
  worshipEndedAt: string;
  solveMinutes: number;
}): Promise<string> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  await requireMember(actor, communityId);
  assertPastor(actor, communityId);
  const ended = seoulDateTime(input.worshipEndedAt);
  if (!ended) throw new ArchiveFlowError("예배가 끝난 시각을 확인해 주세요.");
  if (!Number.isInteger(input.solveMinutes) || input.solveMinutes < 1 || input.solveMinutes > 10080) {
    throw new ArchiveFlowError("풀 수 있는 시간은 1분에서 10080분 사이로 적어 주세요.");
  }
  let questions: QuizQuestion[];
  try {
    questions = parseQuizLines(input.lines);
  } catch (error) {
    if (error instanceof Error) throw new ArchiveFlowError(error.message);
    throw error;
  }
  await assertTextsAllowed(input.title, questions);
  const db = getDb();
  const [created] = await db
    .insert(quizzes)
    .values({
      communityId,
      title: input.title.trim(),
      questionsJson: questions,
      scoresJson: [],
      worshipEndedAt: ended,
      solveMinutes: input.solveMinutes,
    })
    .returning({ id: quizzes.id });
  if (!created) throw new ArchiveFlowError("퀴즈를 저장하지 못했습니다.");
  return created.id;
}

export async function loadQuiz(quizId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "퀴즈를 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 퀴즈를 볼 수 없습니다." };
  }
  const db = getDb();
  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!row) return { ok: false as const, message: "퀴즈를 찾지 못했습니다." };
  assertSameCommunity(row.communityId, communityId);
  const questions = readQuestions(row.questionsJson);
  const mine = readScores(row.scoresJson).find((item) => item.memberId === membership.memberId) ?? null;
  const open = quizWindow({
    worshipEndedAt: row.worshipEndedAt,
    solveMinutes: row.solveMinutes,
    now: new Date(),
  }) === "open";
  const pastor = membership.role === "PASTOR";
  const visible = open || pastor ? (pastor ? questions : publicQuizQuestions(questions)) : [];
  return {
    ok: true as const,
    quiz: {
      id: row.id,
      title: row.title,
      open,
      pastor,
      questions: visible,
      myScore: mine ? { score: mine.score, total: mine.total } : null,
    },
  };
}

export async function submitQuiz(input: { quizId: string; answers: number[] }): Promise<{ score: number; total: number }> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = await requireMember(actor, communityId);
  const db = getDb();
  const [row] = await db.select().from(quizzes).where(eq(quizzes.id, input.quizId)).limit(1);
  if (!row) throw new ArchiveFlowError("퀴즈를 찾지 못했습니다.");
  assertSameCommunity(row.communityId, communityId);
  const questions = readQuestions(row.questionsJson);
  const open = quizWindow({
    worshipEndedAt: row.worshipEndedAt,
    solveMinutes: row.solveMinutes,
    now: new Date(),
  });
  if (open !== "open") throw new ArchiveFlowError("지금은 퀴즈를 풀 수 없습니다.");
  const result = scoreQuiz(questions, input.answers);
  const scores = replaceMemberScore(readScores(row.scoresJson), {
    memberId: membership.memberId,
    score: result.score,
    total: result.total,
    submittedAt: new Date().toISOString(),
  });
  await db
    .update(quizzes)
    .set({ scoresJson: scores, updatedAt: new Date() })
    .where(and(eq(quizzes.id, row.id), eq(quizzes.communityId, communityId)));
  return result;
}

export async function loadQuizHome() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "퀴즈를 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 퀴즈를 볼 수 없습니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const now = new Date();
  const month = monthKey(now);
  const rows = await db.select().from(quizzes).where(eq(quizzes.communityId, communityId)).orderBy(desc(quizzes.createdAt));
  const people = await db.select({ id: members.id, name: members.name }).from(members).where(eq(members.communityId, communityId));
  const names = new Map(people.map((person) => [person.id, person.name]));
  const entries = rows.flatMap((row) =>
    readScores(row.scoresJson).flatMap((score) => {
      const when = new Date(score.submittedAt);
      if (Number.isNaN(when.getTime()) || monthKey(when) !== month) return [];
      return [{ memberId: score.memberId, correct: score.score, firstSubmittedAt: score.submittedAt }];
    }),
  );
  const picked = pickQuizKing(entries);
  const winnerName = picked ? names.get(picked.memberId)?.trim() ?? "" : "";
  const [prize] = await db
    .select()
    .from(quizMonthPrizes)
    .where(and(eq(quizMonthPrizes.communityId, communityId), eq(quizMonthPrizes.yearMonth, month)))
    .limit(1);
  return {
    ok: true as const,
    communityName: community.name,
    canCreate: membership.role === "PASTOR",
    king:
      picked && winnerName
        ? { name: winnerName, correct: picked.correct, prizeName: prize?.prizeName?.trim() || null }
        : null,
    prizeName: prize?.prizeName?.trim() || null,
    quizzes: rows.map((row) => {
      const mine = readScores(row.scoresJson).find((item) => item.memberId === membership.memberId) ?? null;
      return {
        id: row.id,
        title: row.title,
        open:
          quizWindow({
            worshipEndedAt: row.worshipEndedAt,
            solveMinutes: row.solveMinutes,
            now,
          }) === "open",
        myScore: mine ? { score: mine.score, total: mine.total } : null,
      };
    }),
  };
}

export async function saveQuizPrize(prizeName: string): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  await requireMember(actor, communityId);
  assertPastor(actor, communityId);
  const name = prizeName.trim();
  if (!name) throw new ArchiveFlowError("상품 이름을 적어 주세요.");
  if (name.length > 80) throw new ArchiveFlowError("상품 이름은 80자 안으로 적어 주세요.");
  await assertTextsAllowed(name);
  const month = monthKey(new Date());
  const db = getDb();
  const [existing] = await db
    .select()
    .from(quizMonthPrizes)
    .where(and(eq(quizMonthPrizes.communityId, communityId), eq(quizMonthPrizes.yearMonth, month)))
    .limit(1);
  if (existing) {
    await db
      .update(quizMonthPrizes)
      .set({ prizeName: name, updatedAt: new Date() })
      .where(eq(quizMonthPrizes.id, existing.id));
    return;
  }
  await db.insert(quizMonthPrizes).values({ communityId, yearMonth: month, prizeName: name });
}
