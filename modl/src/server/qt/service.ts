/**
 * 말씀 트멍을 등록하고, 묵상과 은혜를 저장합니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 줄은 섞지 않습니다.
 * 글 읽기 열쇠가 없으면 사진에서 글을 만들지 않습니다.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { nextGraceCount, ocrConfigFromEnv, questionLines, reflectionsAfterOwnSubmit } from "@/qt/rules";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, assertSameCommunity, can, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, dailyQts, members, qtGraceReactions, qtReflections } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";
import { readImageText } from "@/server/qt/ocr";
import { saveUpload } from "@/server/uploads";

export class QtFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QtFlowError";
  }
}

export function readableQtError(error: unknown): string {
  if (error instanceof QtFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "말씀을 처리하지 못했습니다.";
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const current = error as { code?: unknown; cause?: unknown };
  if (current.code === "23505") return true;
  return isUniqueViolation(current.cause);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function requireCommunity(actor: Actor): Promise<string> {
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    throw new QtFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  }
  return communityId;
}

async function requireMember(actor: Actor, communityId: string) {
  assertApprovedMember(actor, communityId);
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    throw new QtFlowError("승인 대기 중이거나 이 공동체 구성원이 아니어서 말씀을 볼 수 없습니다.");
  }
  return membership;
}

export async function loadQtHome() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "말씀을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 말씀을 볼 수 없습니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const rows = await db
    .select()
    .from(dailyQts)
    .where(eq(dailyQts.communityId, communityId))
    .orderBy(desc(dailyQts.qtDate), desc(dailyQts.createdAt));
  return {
    ok: true as const,
    communityName: community.name,
    canManage: can(actor, { type: "manage_daily_qt", communityId }),
    ocrReady: ocrConfigFromEnv({ QT_OCR_API_KEY: process.env.QT_OCR_API_KEY }) !== null,
    items: rows.map((row) => ({
      id: row.id,
      qtDate: row.qtDate,
      scriptureTitle: row.scriptureTitle,
    })),
  };
}

export async function createQt(input: {
  qtDate: string;
  scriptureTitle: string;
  scriptureBody: string;
  questionsText: string;
  file: { type: string; size: number; bytes: Buffer } | null;
}): Promise<{ id: string; filledFromOcr: boolean }> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  await requireMember(actor, communityId);
  assertCan(actor, { type: "manage_daily_qt", communityId });

  let scriptureBody = input.scriptureBody.trim();
  let questions = questionLines(input.questionsText);
  let filledFromOcr = false;
  let sourceFileUrl: string | null = null;
  const ocr = ocrConfigFromEnv({ QT_OCR_API_KEY: process.env.QT_OCR_API_KEY });

  if (input.file && input.file.size > 0) {
    const needsOcr = Boolean(ocr) && (!scriptureBody || questions.length === 0);
    if (needsOcr && ocr) {
      const read = await readImageText(input.file, ocr.apiKey);
      if (read.kind === "text") {
        if (!scriptureBody && read.body) {
          scriptureBody = read.body;
          filledFromOcr = true;
        }
        if (questions.length === 0 && read.questions.length > 0) {
          questions = read.questions;
          filledFromOcr = true;
        }
      } else if (!scriptureBody || questions.length === 0) {
        throw new QtFlowError(read.message);
      }
    }
    sourceFileUrl = await saveUpload(input.file);
  }

  if (!scriptureBody) {
    throw new QtFlowError("본문을 적어 주세요.");
  }
  if (questions.length === 0) {
    throw new QtFlowError("질문을 한 줄 이상 적어 주세요.");
  }
  await assertTextsAllowed(input.scriptureTitle, scriptureBody, questions);

  const db = getDb();
  const [created] = await db
    .insert(dailyQts)
    .values({
      communityId,
      qtDate: input.qtDate,
      scriptureTitle: input.scriptureTitle.trim(),
      scriptureBody,
      questionsJson: questions,
      sourceFileUrl,
    })
    .returning({ id: dailyQts.id });
  if (!created) throw new QtFlowError("말씀을 저장하지 못했습니다.");
  return { id: created.id, filledFromOcr };
}

export async function loadQtDetail(qtId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "말씀을 보려면 먼저 들어가 주세요." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 말씀을 볼 수 없습니다." };
  }
  const db = getDb();
  const [qt] = await db.select().from(dailyQts).where(eq(dailyQts.id, qtId)).limit(1);
  if (!qt) return { ok: false as const, message: "말씀을 찾지 못했습니다." };
  assertSameCommunity(qt.communityId, communityId);

  const reflections = await db.select().from(qtReflections).where(eq(qtReflections.qtId, qt.id));
  const memberIds = [...new Set(reflections.map((row) => row.memberId))];
  const people =
    memberIds.length === 0
      ? []
      : await db
          .select({ id: members.id, name: members.name })
          .from(members)
          .where(and(eq(members.communityId, communityId), inArray(members.id, memberIds)));
  const names = new Map(people.map((person) => [person.id, person.name]));
  const stamps = reflections.map((row) => ({
    id: row.id,
    qtId: row.qtId,
    memberId: row.memberId,
    createdAt: row.createdAt.toISOString(),
  }));
  const viewerMemberId = membership.memberId;
  const noticeIds = new Set(reflectionsAfterOwnSubmit(stamps, qt.id, viewerMemberId).map((item) => item.id));
  const graces = await db
    .select({ reflectionId: qtGraceReactions.reflectionId })
    .from(qtGraceReactions)
    .where(eq(qtGraceReactions.memberId, viewerMemberId));
  const graceIds = new Set(graces.map((row) => row.reflectionId));

  function card(row: (typeof reflections)[number]) {
    return {
      id: row.id,
      memberName: names.get(row.memberId) ?? "",
      answers: stringList(row.answersJson),
      graceCount: row.graceCount,
      alreadyGiven: graceIds.has(row.id),
      isMine: row.memberId === viewerMemberId,
    };
  }

  const own = reflections.find((row) => row.memberId === viewerMemberId) ?? null;
  return {
    ok: true as const,
    qt: {
      id: qt.id,
      qtDate: qt.qtDate,
      scriptureTitle: qt.scriptureTitle,
      scriptureBody: qt.scriptureBody,
      questions: stringList(qt.questionsJson),
      sourceFileUrl: qt.sourceFileUrl,
    },
    own: own ? card(own) : null,
    notices: reflections.filter((row) => noticeIds.has(row.id)).map(card),
  };
}

export async function saveReflection(input: { qtId: string; answersText: string }): Promise<void> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = await requireMember(actor, communityId);
  assertCan(actor, { type: "write_own_reflection", communityId, memberId: membership.memberId });
  const answers = questionLines(input.answersText);
  if (answers.length === 0) throw new QtFlowError("묵상 답을 적어 주세요.");

  const db = getDb();
  const [qt] = await db.select().from(dailyQts).where(eq(dailyQts.id, input.qtId)).limit(1);
  if (!qt) throw new QtFlowError("말씀을 찾지 못했습니다.");
  assertSameCommunity(qt.communityId, communityId);
  await assertTextsAllowed(answers);

  await db
    .insert(qtReflections)
    .values({
      qtId: qt.id,
      memberId: membership.memberId,
      answersJson: answers,
    })
    .onConflictDoUpdate({
      target: [qtReflections.qtId, qtReflections.memberId],
      set: {
        answersJson: answers,
        updatedAt: new Date(),
      },
    });
}

export async function giveGrace(input: { qtId: string; reflectionId: string }): Promise<"added" | "kept"> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await requireCommunity(actor);
  const membership = await requireMember(actor, communityId);
  const db = getDb();
  const [row] = await db
    .select({
      reflectionId: qtReflections.id,
      qtId: qtReflections.qtId,
      communityId: dailyQts.communityId,
      graceCount: qtReflections.graceCount,
    })
    .from(qtReflections)
    .innerJoin(dailyQts, eq(qtReflections.qtId, dailyQts.id))
    .where(eq(qtReflections.id, input.reflectionId))
    .limit(1);
  if (!row || row.qtId !== input.qtId) throw new QtFlowError("묵상을 찾지 못했습니다.");
  assertSameCommunity(row.communityId, communityId);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(qtGraceReactions).values({
        reflectionId: row.reflectionId,
        memberId: membership.memberId,
      });
      await tx
        .update(qtReflections)
        .set({
          graceCount: sql`${qtReflections.graceCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(qtReflections.id, row.reflectionId));
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "kept";
    throw error;
  }
  return nextGraceCount(row.graceCount, false) === row.graceCount + 1 ? "added" : "kept";
}
