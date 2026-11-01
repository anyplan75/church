/**
 * 설문 작성과 제출, 결과 열람입니다.
 * 권한은 assertCan 만 쓰고, 다른 공동체 결과는 섞지 않습니다.
 */

import { asc, eq, inArray } from "drizzle-orm";
import { canSubmitSurvey, canViewSurveyResults, questionLines, surveyAnswerMemberId } from "@/survey/rules";
import type { Actor } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, can, formalMembership } from "@/server/auth/rbac";
import { activeCommunityId, loadActor } from "@/server/auth/session";
import { communities, members, surveyResponses, surveys } from "@/server/db/schema";
import { ensureDatabase, getDb } from "@/server/db/runtime";
import { currentChurchIdFor, loadPlaceScope, visibleSharedRows } from "@/server/place/service";
import { assertTextsAllowed } from "@/server/moderation/guard";

export class SurveyFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SurveyFlowError";
  }
}

export function readableSurveyError(error: unknown): string {
  if (error instanceof SurveyFlowError || error instanceof PermissionError) return error.message;
  if (error instanceof Error && /[\uac00-\ud7a3]/.test(error.message)) return error.message;
  return "설문을 처리하지 못했습니다.";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function loadSurveyHome() {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") {
    return { ok: false as const, message: "설문 목록을 보려면 먼저 들어가 주세요. 익명 설문은 받은 주소에서 답을 보냅니다." };
  }
  const communityId = await activeCommunityId(actor);
  if (!communityId) {
    return { ok: false as const, message: "먼저 공동체를 만들거나, 가입 승인을 받아 주세요." };
  }
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    return { ok: false as const, message: "승인 대기 중이거나 이 공동체 구성원이 아니어서 설문 목록을 볼 수 없습니다." };
  }
  const db = getDb();
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return { ok: false as const, message: "공동체를 찾지 못했습니다." };
  const rows = visibleSharedRows(
    await db.select().from(surveys).where(eq(surveys.communityId, communityId)).orderBy(asc(surveys.title)),
    await loadPlaceScope(actor.userId),
  );
  return {
    ok: true as const,
    communityName: community.name,
    canManage: can(actor, { type: "manage_surveys_and_minutes", communityId }),
    surveys: rows.map((row) => ({
      id: row.id,
      title: row.title,
      allowAnonymous: row.allowAnonymous,
      deadline: row.deadline ? row.deadline.toISOString() : null,
      canSeeResults: canViewSurveyResults({
        role: membership.role,
        memberId: membership.memberId,
        createdByMemberId: row.createdByMemberId,
      }),
    })),
  };
}

export async function createSurvey(input: {
  title: string;
  questionsText: string;
  allowAnonymous: boolean;
  deadline: string;
}): Promise<string> {
  await ensureDatabase();
  const actor = await loadActor();
  const communityId = await activeCommunityId(actor);
  if (!communityId) throw new SurveyFlowError("먼저 공동체를 만들거나, 가입 승인을 받아 주세요.");
  assertApprovedMember(actor, communityId);
  const membership = formalMembership(actor, communityId);
  if (!membership) throw new SurveyFlowError("이 공동체 구성원이 아니어서 설문을 만들 수 없습니다.");
  assertCan(actor, { type: "manage_surveys_and_minutes", communityId });
  const questions = questionLines(input.questionsText);
  if (questions.length === 0) throw new SurveyFlowError("질문을 한 줄 이상 적어 주세요.");
  let deadline: Date | null = null;
  if (input.deadline) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.deadline)) {
      throw new SurveyFlowError("마감 시각을 확인해 주세요.");
    }
    deadline = new Date(input.deadline);
    if (Number.isNaN(deadline.getTime())) throw new SurveyFlowError("마감 시각을 확인해 주세요.");
  }
  await assertTextsAllowed(input.title, questions);
  const db = getDb();
  const [created] = await db
    .insert(surveys)
    .values({
      communityId,
      churchId: actor.kind === "user" ? await currentChurchIdFor(actor.userId) : null,
      title: input.title.trim(),
      questionsJson: questions,
      allowAnonymous: input.allowAnonymous,
      deadline,
      createdByMemberId: membership.memberId,
    })
    .returning({ id: surveys.id });
  if (!created) throw new SurveyFlowError("설문을 저장하지 못했습니다.");
  return created.id;
}

export async function loadSurveyForm(surveyId: string) {
  await ensureDatabase();
  const db = getDb();
  const [survey] = await db.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1);
  if (!survey) return { ok: false as const, message: "설문을 찾지 못했습니다." };
  const actor = await loadActor();
  const membership = formalMembership(actor, survey.communityId);
  const allowed = can(actor, {
    type: "answer_survey",
    communityId: survey.communityId,
    allowAnonymous: survey.allowAnonymous,
  });
  if (!allowed) {
    return { ok: false as const, message: "이 설문은 로그인 없이 답을 받지 않습니다." };
  }
  const open = canSubmitSurvey(survey.deadline, new Date());
  return {
    ok: true as const,
    survey: {
      id: survey.id,
      title: survey.title,
      questions: stringList(survey.questionsJson),
      allowAnonymous: survey.allowAnonymous,
      open,
      deadline: survey.deadline ? survey.deadline.toISOString() : null,
    },
    canSeeResults: canViewSurveyResults({
      role: membership?.role ?? null,
      memberId: membership?.memberId ?? null,
      createdByMemberId: survey.createdByMemberId,
    }),
  };
}

export async function submitSurvey(input: { surveyId: string; answers: string[] }): Promise<"saved" | "closed"> {
  await ensureDatabase();
  const db = getDb();
  const [survey] = await db.select().from(surveys).where(eq(surveys.id, input.surveyId)).limit(1);
  if (!survey) throw new SurveyFlowError("설문을 찾지 못했습니다.");
  const actor = await loadActor();
  assertCan(actor, {
    type: "answer_survey",
    communityId: survey.communityId,
    allowAnonymous: survey.allowAnonymous,
  });
  if (!canSubmitSurvey(survey.deadline, new Date())) return "closed";
  const membership = formalMembership(actor, survey.communityId);
  if (!survey.allowAnonymous && !membership) {
    throw new SurveyFlowError("이 설문은 구성원만 답을 보냅니다.");
  }
  const questions = stringList(survey.questionsJson);
  const answers = input.answers.map((answer) => answer.trim());
  if (answers.length < questions.length || answers.some((answer) => answer.length === 0)) {
    throw new SurveyFlowError("모든 질문에 답을 적어 주세요.");
  }
  await assertTextsAllowed(answers);
  await db.insert(surveyResponses).values({
    surveyId: survey.id,
    memberId: surveyAnswerMemberId({
      allowAnonymous: survey.allowAnonymous,
      memberId: membership?.memberId ?? null,
    }),
    answersJson: answers.slice(0, questions.length),
  });
  return "saved";
}

export async function loadSurveyResults(surveyId: string) {
  await ensureDatabase();
  const actor = await loadActor();
  const db = getDb();
  const [survey] = await db.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1);
  if (!survey) return { ok: false as const, message: "설문을 찾지 못했습니다." };
  const communityId = await activeCommunityId(actor);
  if (communityId && communityId !== survey.communityId) {
    return { ok: false as const, message: "다른 공동체의 자료는 열 수 없습니다." };
  }
  const membership = formalMembership(actor, survey.communityId);
  if (
    !canViewSurveyResults({
      role: membership?.role ?? null,
      memberId: membership?.memberId ?? null,
      createdByMemberId: survey.createdByMemberId,
    })
  ) {
    return { ok: false as const, message: "설문 결과는 만든 사람과 사역자, 임원만 봅니다." };
  }
  const responses = await db.select().from(surveyResponses).where(eq(surveyResponses.surveyId, survey.id));
  const memberIds = responses.map((row) => row.memberId).filter((id): id is string => Boolean(id));
  const people =
    memberIds.length === 0
      ? []
      : await db
          .select({ id: members.id, name: members.name })
          .from(members)
          .where(eq(members.communityId, survey.communityId));
  const names = new Map(people.map((person) => [person.id, person.name]));
  return {
    ok: true as const,
    survey: {
      id: survey.id,
      title: survey.title,
      questions: stringList(survey.questionsJson),
      allowAnonymous: survey.allowAnonymous,
    },
    responses: responses.map((row) => ({
      id: row.id,
      authorName: row.memberId ? names.get(row.memberId) ?? "" : null,
      answers: stringList(row.answersJson),
    })),
  };
}

export type SurveyDesk = {
  canCreate: boolean;
  surveys: Array<{
    id: string;
    title: string;
    questions: string[];
    responses: Array<{ id: string; authorName: string | null; answers: string[] }>;
  }>;
};

/** 열린 설문만 구성원 알림으로 돌려줍니다. */
export async function loadOpenSurveyNotices(): Promise<Array<{ id: string; title: string }>> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") return [];
  const communityId = await activeCommunityId(actor);
  if (!communityId) return [];
  if (!formalMembership(actor, communityId)) return [];
  const rows = await getDb().select().from(surveys).where(eq(surveys.communityId, communityId)).orderBy(asc(surveys.title));
  const now = new Date();
  return rows
    .filter((row) => canSubmitSurvey(row.deadline, now))
    .map((row) => ({ id: row.id, title: row.title }));
}

/** 만든 사람과 사역자, 임원이 설정에서 보는 설문입니다. */
export async function loadSurveyDesk(): Promise<SurveyDesk | null> {
  await ensureDatabase();
  const actor = await loadActor();
  if (actor.kind !== "user") return null;
  const communityId = await activeCommunityId(actor);
  if (!communityId) return null;
  const membership = formalMembership(actor, communityId);
  if (!membership) return null;
  const canCreate = can(actor, { type: "manage_surveys_and_minutes", communityId });
  const db = getDb();
  const rows = await db.select().from(surveys).where(eq(surveys.communityId, communityId)).orderBy(asc(surveys.title));
  const visible = rows.filter((row) =>
    canViewSurveyResults({
      role: membership.role,
      memberId: membership.memberId,
      createdByMemberId: row.createdByMemberId,
    }),
  );
  if (!canCreate && visible.length === 0) return null;
  const ids = visible.map((row) => row.id);
  const responses = ids.length === 0 ? [] : await db.select().from(surveyResponses).where(inArray(surveyResponses.surveyId, ids));
  const memberIds = responses.map((row) => row.memberId).filter((id): id is string => Boolean(id));
  const people =
    memberIds.length === 0
      ? []
      : await db.select({ id: members.id, name: members.name }).from(members).where(eq(members.communityId, communityId));
  const names = new Map(people.map((person) => [person.id, person.name]));
  return {
    canCreate,
    surveys: visible.map((row) => ({
      id: row.id,
      title: row.title,
      questions: stringList(row.questionsJson),
      responses: responses
        .filter((response) => response.surveyId === row.id)
        .map((response) => ({
          id: response.id,
          authorName: response.memberId ? names.get(response.memberId) ?? "" : null,
          answers: stringList(response.answersJson),
        })),
    })),
  };
}
