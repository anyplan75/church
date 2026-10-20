/**
 * 행사 기록과 퀴즈를 저장합니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 줄은 섞지 않습니다.
 * 퀴즈를 푸는 응답에는 정답 번호를 넣지 않습니다.
 */

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  linkLines,
  parseQuizLines,
  publicQuizQuestions,
  replaceMemberScore,
  scoreQuiz,
  youtubeEmbedUrl,
  type QuizQuestion,
  type QuizScore,
} from "@/archive/rules";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, assertSameCommunity, can, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, eventArchives, quizzes } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";

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
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 기록을 볼 수 없습니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const events = await db
    .select({ id: eventArchives.id, title: eventArchives.title })
    .from(eventArchives)
    .where(eq(eventArchives.communityId, communityId))
    .orderBy(desc(eventArchives.createdAt));
  const quizRows = await db
    .select({ id: quizzes.id, title: quizzes.title })
    .from(quizzes)
    .where(eq(quizzes.communityId, communityId))
    .orderBy(desc(quizzes.createdAt));
  return {
    ok: true as const,
    communityName: community.name,
    canManage: can(actor, { type: "manage_archive", communityId }),
    events,
    quizzes: quizRows,
  };
}

export async function createArchive(input: { title: string; photoText: string; youtubeText: string }): Promise<string> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  await requireMember(actor, communityId);
  assertCan(actor, { type: "manage_archive", communityId });
  const photoUrls = linkLines(input.photoText);
  for (const photoUrl of photoUrls) {
    if (!httpUrl(photoUrl)) throw new ArchiveFlowError("사진 주소는 http 또는 https 로 시작해 주세요.");
  }
  const youtubeUrls = linkLines(input.youtubeText);
  for (const youtubeUrl of youtubeUrls) {
    if (!youtubeEmbedUrl(youtubeUrl)) throw new ArchiveFlowError("유튜브 주소만 영상으로 넣을 수 있습니다.");
  }
  const db = getDb();
  const [created] = await db
    .insert(eventArchives)
    .values({
      communityId,
      title: input.title.trim(),
      photoUrls,
      youtubeUrls,
    })
    .returning({ id: eventArchives.id });
  if (!created) throw new ArchiveFlowError("행사 기록을 저장하지 못했습니다.");
  return created.id;
}

export async function loadArchiveDetail(archiveId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "기록을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 기록을 볼 수 없습니다." };
  }
  const db = getDb();
  const [row] = await db.select().from(eventArchives).where(eq(eventArchives.id, archiveId)).limit(1);
  if (!row) return { ok: false as const, message: "행사 기록을 찾지 못했습니다." };
  assertSameCommunity(row.communityId, communityId);
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

export async function createQuiz(input: { title: string; lines: string }): Promise<string> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  await requireMember(actor, communityId);
  assertCan(actor, { type: "manage_archive", communityId });
  let questions: QuizQuestion[];
  try {
    questions = parseQuizLines(input.lines);
  } catch (error) {
    if (error instanceof Error) throw new ArchiveFlowError(error.message);
    throw error;
  }
  const db = getDb();
  const [created] = await db
    .insert(quizzes)
    .values({
      communityId,
      title: input.title.trim(),
      questionsJson: questions,
      scoresJson: [],
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
  return {
    ok: true as const,
    quiz: {
      id: row.id,
      title: row.title,
      questions: publicQuizQuestions(questions),
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
