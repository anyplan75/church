/**
 * 질문과 목사 답글을 저장합니다.
 * 보이는 범위는 questions/rules.ts 와 같습니다.
 */

import { and, desc, eq } from "drizzle-orm";
import type { Actor } from "@/server/auth/actor";
import { assertCan, assertSameCommunity, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { members, questionReplies, questions } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { assertTextsAllowed } from "@/server/moderation/guard";
import { readableError } from "@/server/community/service";
import {
  canAnswerQuestion,
  canApproveReply,
  canReviewReply,
  canSeeQuestion,
  canSeeReplyBody,
  type QuestionAudience,
  type QuestionViewer,
} from "@/questions/rules";

export class QuestionFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionFlowError";
  }
}

function viewerFrom(actor: Actor, communityId: string): QuestionViewer {
  const membership = formalMembership(actor, communityId);
  if (actor.kind !== "user" || !membership) {
    return { userId: actor.kind === "user" ? actor.userId : null, memberId: null, role: null, cohort: null };
  }
  return {
    userId: actor.userId,
    memberId: membership.memberId,
    role: membership.role,
    cohort: membership.cohort ?? null,
  };
}

async function communityForActor(actor: Actor): Promise<string> {
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new QuestionFlowError("먼저 공동체에 들어가 주세요.");
  return communityId;
}

export async function loadQuestionHome() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { canAsk: false as const, pastors: [], questions: [] as QuestionCard[] };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId || !formalMembership(actor, communityId)) {
    return { canAsk: false as const, pastors: [], questions: [] as QuestionCard[] };
  }
  const viewer = viewerFrom(actor, communityId);
  const db = getDb();
  const pastors = await db
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.communityId, communityId), eq(members.role, "PASTOR"), eq(members.status, "ACTIVE")));
  const rows = await db
    .select({
      id: questions.id,
      body: questions.body,
      audience: questions.audience,
      authorUserId: questions.authorUserId,
      designatedPastorMemberId: questions.designatedPastorMemberId,
      pastorName: members.name,
    })
    .from(questions)
    .leftJoin(members, eq(questions.designatedPastorMemberId, members.id))
    .where(eq(questions.communityId, communityId))
    .orderBy(desc(questions.createdAt));
  const replyRows = await db
    .select({
      questionId: questionReplies.questionId,
      status: questionReplies.status,
    })
    .from(questionReplies)
    .where(eq(questionReplies.communityId, communityId));

  const cards: QuestionCard[] = [];
  for (const row of rows) {
    const access = {
      authorUserId: row.authorUserId,
      designatedPastorMemberId: row.designatedPastorMemberId,
      audience: row.audience,
    };
    if (!canSeeQuestion(viewer, access)) continue;
    const mine = replyRows.filter((reply) => reply.questionId === row.id);
    const own = viewer.userId === row.authorUserId;
    cards.push({
      id: row.id,
      body: row.body,
      audience: row.audience,
      pastorName: row.pastorName,
      answerState: !own ? "hidden" : mine.some((reply) => reply.status === "APPROVED") ? "arrived" : mine.length > 0 ? "waiting" : "none",
    });
  }
  return { canAsk: true as const, pastors, questions: cards };
}

export type QuestionCard = {
  id: string;
  body: string;
  audience: QuestionAudience;
  pastorName: string | null;
  answerState: "hidden" | "none" | "waiting" | "arrived";
};

export async function askQuestion(input: {
  body: string;
  audience: QuestionAudience;
  pastorMemberId: string | null;
}) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await communityForActor(actor);
  assertCan(actor, { type: "ask_question", communityId });
  const body = input.body.trim();
  if (!body) throw new QuestionFlowError("질문을 적어 주세요.");
  if (body.length > 2000) throw new QuestionFlowError("질문은 2000자 안으로 적어 주세요.");
  if (actor.kind !== "user") throw new QuestionFlowError("로그인 후 질문할 수 있습니다.");
  if (input.pastorMemberId) {
    const [pastor] = await getDb()
      .select()
      .from(members)
      .where(eq(members.id, input.pastorMemberId))
      .limit(1);
    if (!pastor || pastor.role !== "PASTOR" || pastor.status !== "ACTIVE") {
      throw new QuestionFlowError("목사로 등록된 사람을 지정해 주세요.");
    }
    assertSameCommunity(communityId, pastor.communityId);
  }
  await assertTextsAllowed(body);
  const [created] = await getDb()
    .insert(questions)
    .values({
      communityId,
      authorUserId: actor.userId,
      body,
      audience: input.audience,
      designatedPastorMemberId: input.pastorMemberId,
    })
    .returning({ id: questions.id });
  return created.id;
}

export async function loadQuestionDetail(questionId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) return { ok: false as const, message: "먼저 공동체에 들어가 주세요." };
  const [row] = await getDb()
    .select({
      id: questions.id,
      communityId: questions.communityId,
      body: questions.body,
      audience: questions.audience,
      authorUserId: questions.authorUserId,
      designatedPastorMemberId: questions.designatedPastorMemberId,
      pastorName: members.name,
    })
    .from(questions)
    .leftJoin(members, eq(questions.designatedPastorMemberId, members.id))
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!row) return { ok: false as const, message: "질문을 찾지 못했습니다." };
  try {
    assertSameCommunity(communityId, row.communityId);
  } catch (error) {
    return { ok: false as const, message: readableError(error) };
  }
  const viewer = viewerFrom(actor, communityId);
  const access = {
    authorUserId: row.authorUserId,
    designatedPastorMemberId: row.designatedPastorMemberId,
    audience: row.audience,
  };
  const replies = await getDb()
    .select({
      id: questionReplies.id,
      body: questionReplies.body,
      status: questionReplies.status,
      authorMemberId: questionReplies.authorMemberId,
      authorName: members.name,
    })
    .from(questionReplies)
    .innerJoin(members, eq(questionReplies.authorMemberId, members.id))
    .where(eq(questionReplies.questionId, row.id));
  const reviewer = canReviewReply(viewer.role);
  if (!canSeeQuestion(viewer, access) && !(reviewer && replies.length > 0)) {
    return { ok: false as const, message: "이 질문은 볼 수 없습니다." };
  }
  const visibleReplies = replies.flatMap((reply) => {
    const approved = reply.status === "APPROVED";
    if (!canSeeReplyBody({ viewer, question: access, replyAuthorMemberId: reply.authorMemberId, approved })) {
      return [];
    }
    return [
      {
        id: reply.id,
        body: reply.body,
        approved,
        authorName: reply.authorName,
        canApprove: !approved && canApproveReply(viewer, reply.authorMemberId),
      },
    ];
  });
  const askerWaiting =
    viewer.userId === row.authorUserId &&
    replies.some((reply) => reply.status === "PENDING") &&
    !replies.some((reply) => reply.status === "APPROVED");
  return {
    ok: true as const,
    question: {
      id: row.id,
      body: row.body,
      audience: row.audience,
      pastorName: row.pastorName,
      canAnswer: canAnswerQuestion(viewer, access) && !replies.some((reply) => reply.authorMemberId === viewer.memberId),
      askerWaiting,
    },
    replies: visibleReplies,
  };
}

export async function answerQuestion(questionId: string, body: string) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await communityForActor(actor);
  const viewer = viewerFrom(actor, communityId);
  const text = body.trim();
  if (!text) throw new QuestionFlowError("답글을 적어 주세요.");
  if (text.length > 2000) throw new QuestionFlowError("답글은 2000자 안으로 적어 주세요.");
  const [row] = await getDb().select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (!row) throw new QuestionFlowError("질문을 찾지 못했습니다.");
  assertSameCommunity(communityId, row.communityId);
  const access = {
    authorUserId: row.authorUserId,
    designatedPastorMemberId: row.designatedPastorMemberId,
    audience: row.audience,
  };
  if (!canAnswerQuestion(viewer, access) || !viewer.memberId) {
    throw new QuestionFlowError("답글은 목사로 등록된 사람이 씁니다.");
  }
  const existing = await getDb()
    .select({ id: questionReplies.id })
    .from(questionReplies)
    .where(and(eq(questionReplies.questionId, row.id), eq(questionReplies.authorMemberId, viewer.memberId)))
    .limit(1);
  if (existing.length > 0) throw new QuestionFlowError("이미 답글을 남겼습니다.");
  await assertTextsAllowed(text);
  await getDb().insert(questionReplies).values({
    communityId,
    questionId: row.id,
    authorMemberId: viewer.memberId,
    body: text,
    status: "PENDING",
  });
}

export async function approveQuestionReply(replyId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await communityForActor(actor);
  assertCan(actor, { type: "review_question_reply", communityId });
  const viewer = viewerFrom(actor, communityId);
  const [reply] = await getDb().select().from(questionReplies).where(eq(questionReplies.id, replyId)).limit(1);
  if (!reply) throw new QuestionFlowError("답글을 찾지 못했습니다.");
  assertSameCommunity(communityId, reply.communityId);
  if (!canApproveReply(viewer, reply.authorMemberId)) {
    throw new QuestionFlowError("이 답글은 승인할 수 없습니다.");
  }
  if (actor.kind !== "user") throw new QuestionFlowError("로그인 후 승인할 수 있습니다.");
  if (reply.status === "APPROVED") return reply.questionId;
  await getDb()
    .update(questionReplies)
    .set({
      status: "APPROVED",
      approvedByUserId: actor.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(questionReplies.id, reply.id), eq(questionReplies.communityId, communityId)));
  return reply.questionId;
}

export async function loadPendingReplies() {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) return { ok: false as const, message: "먼저 공동체에 들어가 주세요." };
  try {
    assertCan(actor, { type: "review_question_reply", communityId });
  } catch (error) {
    return { ok: false as const, message: readableError(error) };
  }
  const viewer = viewerFrom(actor, communityId);
  const rows = await getDb()
    .select({
      id: questionReplies.id,
      body: questionReplies.body,
      authorMemberId: questionReplies.authorMemberId,
      authorName: members.name,
      questionId: questions.id,
      questionBody: questions.body,
    })
    .from(questionReplies)
    .innerJoin(questions, eq(questionReplies.questionId, questions.id))
    .innerJoin(members, eq(questionReplies.authorMemberId, members.id))
    .where(and(eq(questionReplies.communityId, communityId), eq(questionReplies.status, "PENDING")))
    .orderBy(desc(questionReplies.createdAt));
  return {
    ok: true as const,
    replies: rows.filter((row) => canApproveReply(viewer, row.authorMemberId)),
  };
}
