import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAnswerQuestion,
  canApproveReply,
  canSeeQuestion,
  canSeeReplyBody,
  type QuestionAccess,
  type QuestionViewer,
} from "@/questions/rules";

const question: QuestionAccess = {
  authorUserId: "asker",
  designatedPastorMemberId: null,
  audience: "PASTORS",
};

function viewer(extra: Partial<QuestionViewer> = {}): QuestionViewer {
  return {
    userId: "user",
    memberId: "member",
    role: "MEMBER",
    cohort: null,
    ...extra,
  };
}

describe("질문 범위", () => {
  it("목사에게만 고른 질문은 목사와 질문한 사람만 봅니다", () => {
    assert.equal(canSeeQuestion(viewer({ userId: "asker" }), question), true);
    assert.equal(canSeeQuestion(viewer({ role: "PASTOR" }), question), true);
    assert.equal(canSeeQuestion(viewer({ role: "EXECUTIVE" }), question), false);
    assert.equal(canSeeQuestion(viewer({ cohort: "PEER" }), question), false);
    assert.equal(canSeeQuestion(viewer({ cohort: "SENIOR" }), question), false);
    assert.equal(canSeeQuestion(viewer({ userId: null, memberId: null, role: null }), question), false);
  });

  it("또래 질문은 또래만, 선배 질문은 선배만 봅니다", () => {
    const peers: QuestionAccess = { ...question, audience: "PEERS" };
    const seniors: QuestionAccess = { ...question, audience: "SENIORS" };
    assert.equal(canSeeQuestion(viewer({ cohort: "PEER" }), peers), true);
    assert.equal(canSeeQuestion(viewer({ cohort: "SENIOR" }), peers), false);
    assert.equal(canSeeQuestion(viewer({ role: "PASTOR", cohort: null }), peers), false);
    assert.equal(canSeeQuestion(viewer({ cohort: "SENIOR" }), seniors), true);
    assert.equal(canSeeQuestion(viewer({ cohort: "PEER" }), seniors), false);
  });

  it("지정한 목사는 범위 밖이어도 그 질문을 봅니다", () => {
    const seniors: QuestionAccess = { ...question, audience: "SENIORS", designatedPastorMemberId: "pastor-1" };
    assert.equal(
      canSeeQuestion(viewer({ role: "PASTOR", memberId: "pastor-1", cohort: "PEER" }), seniors),
      true,
    );
    assert.equal(canSeeQuestion(viewer({ role: "PASTOR", memberId: "pastor-2" }), seniors), false);
  });
});

describe("답글", () => {
  it("목사를 지정하면 그 목사만 답합니다", () => {
    const designated: QuestionAccess = { ...question, designatedPastorMemberId: "pastor-1" };
    assert.equal(canAnswerQuestion(viewer({ role: "PASTOR", memberId: "pastor-1" }), designated), true);
    assert.equal(canAnswerQuestion(viewer({ role: "PASTOR", memberId: "pastor-2" }), designated), false);
    assert.equal(canAnswerQuestion(viewer({ role: "EXECUTIVE" }), designated), false);
    assert.equal(canAnswerQuestion(viewer({ role: "PASTOR", userId: "asker", memberId: "pastor-1" }), designated), false);
  });

  it("지정하지 않으면 그 질문을 보는 목사가 답합니다", () => {
    assert.equal(canAnswerQuestion(viewer({ role: "PASTOR" }), question), true);
    const peers: QuestionAccess = { ...question, audience: "PEERS" };
    assert.equal(canAnswerQuestion(viewer({ role: "PASTOR", cohort: null }), peers), false);
    assert.equal(canAnswerQuestion(viewer({ role: "PASTOR", cohort: "PEER" }), peers), true);
  });

  it("승인 전에는 질문한 사람에게 답글이 보이지 않습니다", () => {
    const asker = viewer({ userId: "asker", role: "MEMBER" });
    assert.equal(
      canSeeReplyBody({ viewer: asker, question, replyAuthorMemberId: "pastor-1", approved: false }),
      false,
    );
    assert.equal(
      canSeeReplyBody({ viewer: asker, question, replyAuthorMemberId: "pastor-1", approved: true }),
      true,
    );
    const officerAsker = viewer({ userId: "asker", role: "EXECUTIVE", memberId: "exec" });
    assert.equal(
      canSeeReplyBody({ viewer: officerAsker, question, replyAuthorMemberId: "pastor-1", approved: false }),
      false,
    );
  });

  it("승인된 답글도 또래나 선배에게는 보이지 않습니다", () => {
    const peer = viewer({ cohort: "PEER", role: "MEMBER" });
    const peers: QuestionAccess = { ...question, audience: "PEERS" };
    assert.equal(
      canSeeReplyBody({ viewer: peer, question: peers, replyAuthorMemberId: "pastor-1", approved: true }),
      false,
    );
  });

  it("임원은 남의 답글을 승인하고, 목사는 자기 답글을 승인하지 못합니다", () => {
    assert.equal(canApproveReply(viewer({ role: "EXECUTIVE", memberId: "exec" }), "pastor-1"), true);
    assert.equal(canApproveReply(viewer({ role: "PASTOR", memberId: "pastor-1" }), "pastor-1"), false);
    assert.equal(canApproveReply(viewer({ role: "PASTOR", memberId: "pastor-2" }), "pastor-1"), true);
    assert.equal(canApproveReply(viewer({ role: "MEMBER" }), "pastor-1"), false);
  });

  it("답글을 쓴 목사와 승인하는 사람은 승인 전 본문을 봅니다", () => {
    assert.equal(
      canSeeReplyBody({
        viewer: viewer({ role: "PASTOR", memberId: "pastor-1" }),
        question,
        replyAuthorMemberId: "pastor-1",
        approved: false,
      }),
      true,
    );
    assert.equal(
      canSeeReplyBody({
        viewer: viewer({ role: "EXECUTIVE", memberId: "exec" }),
        question,
        replyAuthorMemberId: "pastor-1",
        approved: false,
      }),
      true,
    );
    assert.equal(
      canSeeReplyBody({
        viewer: viewer({ role: "EXECUTIVE", memberId: "exec" }),
        question,
        replyAuthorMemberId: "pastor-1",
        approved: true,
      }),
      false,
    );
  });
});
