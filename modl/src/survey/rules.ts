/**
 * 설문 마감과 결과 열람, 익명 답의 작성자 번호입니다.
 * 데이터베이스에 접속하지 않습니다.
 */

import type { MemberRole } from "@/server/auth/actor";

/** 마감 시각이 지나면 제출할 수 없습니다. 마감이 없으면 열려 있습니다. */
export function canSubmitSurvey(deadline: Date | null, now: Date): boolean {
  if (!deadline) return true;
  return now.getTime() <= deadline.getTime();
}

/** 만든 사람과 사역자, 임원만 결과를 봅니다. */
export function canViewSurveyResults(input: {
  role: MemberRole | null;
  memberId: string | null;
  createdByMemberId: string | null;
}): boolean {
  if (input.role === "PASTOR" || input.role === "EXECUTIVE") return true;
  if (!input.memberId || !input.createdByMemberId) return false;
  return input.memberId === input.createdByMemberId;
}

/**
 * 익명 설문은 로그인 여부와 상관없이 작성자 번호를 저장하지 않습니다.
 * 실명 설문은 구성원 번호가 있어야 합니다.
 */
export function surveyAnswerMemberId(input: { allowAnonymous: boolean; memberId: string | null }): string | null {
  if (input.allowAnonymous) return null;
  return input.memberId;
}

export function questionLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
