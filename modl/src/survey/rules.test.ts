import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Actor } from "@/server/auth/actor";
import { can } from "@/server/auth/rbac";
import { canSubmitSurvey, canViewSurveyResults, surveyAnswerMemberId } from "@/survey/rules";

const guest: Actor = { kind: "guest" };
const member: Actor = {
  kind: "user",
  userId: "user-1",
  memberships: [
    {
      communityId: "community-a",
      memberId: "member-1",
      role: "MEMBER",
      currentGroupId: null,
      leaderGroupIds: [],
    },
  ],
  pendingCommunityIds: [],
};

describe("마감 설문 거부", () => {
  const deadline = new Date("2026-10-20T12:00:00.000Z");

  it("마감 시각이 지나면 제출하지 못합니다", () => {
    assert.equal(canSubmitSurvey(deadline, new Date("2026-10-20T12:00:00.000Z")), true);
    assert.equal(canSubmitSurvey(deadline, new Date("2026-10-20T12:00:01.000Z")), false);
  });

  it("마감이 없으면 제출할 수 있습니다", () => {
    assert.equal(canSubmitSurvey(null, new Date("2026-10-21T00:00:00.000Z")), true);
  });
});

describe("익명 설문", () => {
  it("손님은 익명 설문만 제출할 수 있습니다", () => {
    assert.equal(can(guest, { type: "answer_survey", communityId: "community-a", allowAnonymous: true }), true);
    assert.equal(can(guest, { type: "answer_survey", communityId: "community-a", allowAnonymous: false }), false);
    assert.equal(can(member, { type: "answer_survey", communityId: "community-a", allowAnonymous: false }), true);
  });

  it("익명 설문은 작성자 번호를 비우고 실명 설문은 번호를 남깁니다", () => {
    assert.equal(surveyAnswerMemberId({ allowAnonymous: true, memberId: null }), null);
    assert.equal(surveyAnswerMemberId({ allowAnonymous: true, memberId: "member-1" }), null);
    assert.equal(surveyAnswerMemberId({ allowAnonymous: false, memberId: "member-1" }), "member-1");
  });
});

describe("설문 결과", () => {
  it("만든 사람과 사역자, 임원만 결과를 봅니다", () => {
    assert.equal(
      canViewSurveyResults({ role: "PASTOR", memberId: "pastor", createdByMemberId: "maker" }),
      true,
    );
    assert.equal(
      canViewSurveyResults({ role: "EXECUTIVE", memberId: "exec", createdByMemberId: "maker" }),
      true,
    );
    assert.equal(
      canViewSurveyResults({ role: "MEMBER", memberId: "maker", createdByMemberId: "maker" }),
      true,
    );
    assert.equal(
      canViewSurveyResults({ role: "MEMBER", memberId: "other", createdByMemberId: "maker" }),
      false,
    );
    assert.equal(canViewSurveyResults({ role: null, memberId: null, createdByMemberId: "maker" }), false);
  });
});
