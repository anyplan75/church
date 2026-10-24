import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  archiveScopeLabel,
  archiveTargets,
  canSeeArchive,
  linkLines,
  parseQuizLines,
  monthKey,
  pickQuizKing,
  publicQuizQuestions,
  quizWindow,
  replaceMemberScore,
  scoreQuiz,
  youtubeEmbedUrl,
} from "@/archive/rules";

describe("행사 영상 주소", () => {
  it("시청 주소와 짧은 주소와 짧은 영상 주소를 재생 칸으로 바꿉니다", () => {
    assert.equal(
      youtubeEmbedUrl("https://www.youtube.com/watch?v=M7lc1UVf-VE"),
      "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
    );
    assert.equal(youtubeEmbedUrl("https://youtu.be/M7lc1UVf-VE"), "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE");
    assert.equal(
      youtubeEmbedUrl("https://www.youtube.com/shorts/M7lc1UVf-VE"),
      "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
    );
    assert.equal(
      youtubeEmbedUrl("https://www.youtube.com/embed/M7lc1UVf-VE"),
      "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
    );
  });

  it("다른 사이트 주소는 받지 않습니다", () => {
    assert.equal(youtubeEmbedUrl("https://example.com/watch?v=M7lc1UVf-VE"), null);
    assert.equal(youtubeEmbedUrl("javascript:alert(1)"), null);
  });
});

describe("퀴즈 점수", () => {
  const questions = parseQuizLines("빛의 색은?|빨강|초록|파랑|2\n하루는 며칠?|하루|이틀|1");

  it("정답 번호는 0부터가 아니라 사람이 센 1부터 저장합니다", () => {
    assert.equal(questions[0]?.answerIndex, 1);
    assert.equal(questions[1]?.answerIndex, 0);
  });

  it("푸는 화면용 질문에는 정답 번호가 없습니다", () => {
    const visible = publicQuizQuestions(questions);
    assert.equal(JSON.stringify(visible).includes("answerIndex"), false);
    assert.equal(visible[0]?.choices[1], "초록");
  });

  it("맞힌 개수를 저장할 점수로 만듭니다", () => {
    assert.deepEqual(scoreQuiz(questions, [1, 0]), { score: 2, total: 2 });
    assert.deepEqual(scoreQuiz(questions, [0]), { score: 0, total: 2 });
  });

  it("같은 사람이 다시 풀면 이전 점수를 새 점수로 바꿉니다", () => {
    const first = { memberId: "member-1", score: 1, total: 2, submittedAt: "2026-10-20T00:00:00.000Z" };
    const second = { memberId: "member-1", score: 2, total: 2, submittedAt: "2026-10-20T01:00:00.000Z" };
    const other = { memberId: "member-2", score: 0, total: 2, submittedAt: "2026-10-20T00:30:00.000Z" };
    assert.deepEqual(replaceMemberScore([first, other], second), [other, second]);
  });

  it("예배가 끝난 뒤 정한 분 안에만 열립니다", () => {
    const start = new Date("2026-10-21T01:00:00.000Z");
    assert.equal(quizWindow({ worshipEndedAt: start, solveMinutes: 30, now: new Date("2026-10-21T01:10:00.000Z") }), "open");
    assert.equal(quizWindow({ worshipEndedAt: start, solveMinutes: 30, now: new Date("2026-10-21T00:59:00.000Z") }), "closed");
    assert.equal(quizWindow({ worshipEndedAt: start, solveMinutes: 30, now: new Date("2026-10-21T01:31:00.000Z") }), "closed");
    assert.equal(quizWindow({ worshipEndedAt: null, solveMinutes: 30, now: start }), "closed");
  });

  it("맞힌 수가 같고 먼저 낸 사람이 퀴즈왕입니다", () => {
    const winner = pickQuizKing([
      { memberId: "late", correct: 2, firstSubmittedAt: "2026-10-21T02:00:00.000Z" },
      { memberId: "early", correct: 1, firstSubmittedAt: "2026-10-21T01:00:00.000Z" },
      { memberId: "early", correct: 1, firstSubmittedAt: "2026-10-21T03:00:00.000Z" },
    ]);
    assert.equal(winner?.memberId, "early");
    assert.equal(winner?.correct, 2);
    assert.equal(winner?.firstSubmittedAt, "2026-10-21T01:00:00.000Z");
    assert.equal(pickQuizKing([]), null);
  });

  it("달은 서울 달력으로 고릅니다", () => {
    assert.equal(monthKey(new Date("2026-10-31T15:30:00.000Z")), "2026-11");
    assert.equal(monthKey(new Date("2026-10-31T14:30:00.000Z")), "2026-10");
  });

  it("체크한 교회와 모들마다 자료를 올리고 빈 선택은 거절합니다", () => {
    const allowedChurchIds = new Set(["c1", "c2"]);
    const allowedGatheringIds = new Set(["g1", "g2"]);
    assert.equal(archiveTargets({ churchIds: [], gatheringIds: [], allowedChurchIds, allowedGatheringIds }).ok, false);
    assert.equal(archiveTargets({ churchIds: ["c9"], gatheringIds: [], allowedChurchIds, allowedGatheringIds }).ok, false);
    assert.deepEqual(archiveTargets({ churchIds: ["c1", "c1"], gatheringIds: ["g2"], allowedChurchIds, allowedGatheringIds }), {
      ok: true,
      places: [
        { churchId: "c1", groupId: null },
        { churchId: null, groupId: "g2" },
      ],
    });
    assert.equal(canSeeArchive({ churchId: "c2", groupId: null }, new Set(["c1"]), new Set(["g1"])), false);
    assert.equal(canSeeArchive({ churchId: "c1", groupId: "g9" }, new Set(["c1"]), new Set(["g1"])), true);
    assert.equal(canSeeArchive({ churchId: "c9", groupId: "g1" }, new Set(), new Set(["g1"])), true);
    assert.equal(canSeeArchive({ churchId: null, groupId: null }, allowedChurchIds, allowedGatheringIds), false);
    assert.equal(archiveScopeLabel({ churchName: "남원교회", gatheringName: "청년모들" }), "교회 · 남원교회 · 모들 · 청년모들");
    assert.equal(archiveScopeLabel({ churchName: null, gatheringName: null }), "");
  });

  it("주소는 빈 줄을 버립니다", () => {
    assert.deepEqual(linkLines("https://example.com/a.jpg\n\nhttps://example.com/b.jpg"), [
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
  });
});
