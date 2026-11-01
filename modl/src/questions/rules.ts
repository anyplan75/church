/**
 * 질문과 답글이 누구에게 보이는지 정합니다.
 * 화면과 서버가 같은 규칙을 씁니다. 데이터베이스에는 접속하지 않습니다.
 */

export const QUESTION_AUDIENCES = ["PASTORS", "PEERS", "SENIORS"] as const;
export type QuestionAudience = (typeof QUESTION_AUDIENCES)[number];

export const MEMBER_COHORTS = ["PEER", "SENIOR"] as const;
export type MemberCohort = (typeof MEMBER_COHORTS)[number];

export const AUDIENCE_LABEL: Record<QuestionAudience, string> = {
  PASTORS: "목사에게만",
  PEERS: "또래에게만",
  SENIORS: "선배에게만",
};

export const COHORT_LABEL: Record<MemberCohort, string> = {
  PEER: "또래",
  SENIOR: "선배",
};

type ViewerRole = "PASTOR" | "EXECUTIVE" | "CELL_LEADER" | "MEMBER" | "NEWCOMER" | null;

export type QuestionViewer = {
  userId: string | null;
  memberId: string | null;
  role: ViewerRole;
  cohort: MemberCohort | null;
};

export type QuestionAccess = {
  authorUserId: string;
  designatedPastorMemberId: string | null;
  audience: QuestionAudience;
};

export function isQuestionAudience(value: string): value is QuestionAudience {
  return (QUESTION_AUDIENCES as readonly string[]).includes(value);
}

export function isMemberCohort(value: string): value is MemberCohort {
  return (MEMBER_COHORTS as readonly string[]).includes(value);
}

function matchesAudience(viewer: QuestionViewer, audience: QuestionAudience): boolean {
  if (audience === "PASTORS") return viewer.role === "PASTOR";
  if (audience === "PEERS") return viewer.cohort === "PEER";
  return viewer.cohort === "SENIOR";
}

/** 질문 목록에 이 글을 넣을 수 있는지입니다. 임원은 여기서 빠지고, 승인 화면에서 답글을 봅니다. */
export function canSeeQuestion(viewer: QuestionViewer, question: QuestionAccess): boolean {
  if (!viewer.userId) return false;
  if (viewer.userId === question.authorUserId) return true;
  if (viewer.memberId && viewer.memberId === question.designatedPastorMemberId) return true;
  return matchesAudience(viewer, question.audience);
}

/** 등록된 목사만 답합니다. 목사를 지정했으면 그 사람만 답합니다. */
export function canAnswerQuestion(viewer: QuestionViewer, question: QuestionAccess): boolean {
  if (viewer.role !== "PASTOR" || !viewer.memberId || !viewer.userId) return false;
  if (viewer.userId === question.authorUserId) return false;
  if (question.designatedPastorMemberId) return viewer.memberId === question.designatedPastorMemberId;
  return canSeeQuestion(viewer, question);
}

export function canReviewReply(role: ViewerRole): boolean {
  return role === "PASTOR" || role === "EXECUTIVE";
}

/** 자기 답글은 스스로 승인하지 못합니다. */
export function canApproveReply(viewer: QuestionViewer, replyAuthorMemberId: string): boolean {
  if (!canReviewReply(viewer.role)) return false;
  return viewer.memberId !== replyAuthorMemberId;
}

/**
 * 승인 전 답글은 질문한 사람에게 숨기고, 승인할 사람과 쓴 목사만 봅니다.
 * 승인 후에는 질문한 사람과 그 목사에게만 본문이 보입니다.
 */
export function canSeeReplyBody(input: {
  viewer: QuestionViewer;
  question: QuestionAccess;
  replyAuthorMemberId: string;
  approved: boolean;
}): boolean {
  const { viewer, question, replyAuthorMemberId, approved } = input;
  if (viewer.memberId && viewer.memberId === replyAuthorMemberId) return true;
  if (!approved && viewer.userId !== question.authorUserId && canApproveReply(viewer, replyAuthorMemberId)) return true;
  if (approved && viewer.userId === question.authorUserId) return true;
  return false;
}
