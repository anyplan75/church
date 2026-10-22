import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBannedWord, normalizeBannedWord } from "@/moderation/match";

const WORDS = ["금칙", "짧은", "나쁜 말"];

describe("금지어 단어 경계", () => {
  it("띄어 쓴 단어와 문장 부호에 붙은 단어만 찾습니다", () => {
    assert.equal(findBannedWord("오늘은 금칙 입니다", WORDS), "금칙");
    assert.equal(findBannedWord("금칙", WORDS), "금칙");
    assert.equal(findBannedWord("금칙!", WORDS), "금칙");
    assert.equal(findBannedWord("끝\n금칙", WORDS), "금칙");
  });

  it("짧은 음절이 평범한 단어 안에 끼어 있으면 막지 않습니다", () => {
    assert.equal(findBannedWord("금칙점", WORDS), null);
    assert.equal(findBannedWord("시작금칙입니다", WORDS), null);
    assert.equal(findBannedWord("짧은점", WORDS), null);
    assert.equal(findBannedWord("아주짧은말", WORDS), null);
    assert.equal(findBannedWord("발표", ["표"]), null);
  });

  it("띄어 쓴 말은 이어진 단어일 때만 찾습니다", () => {
    assert.equal(findBannedWord("정말 나쁜 말 입니다", WORDS), "나쁜 말");
    assert.equal(findBannedWord("정말 나쁜   말", WORDS), "나쁜 말");
    assert.equal(findBannedWord("나쁜말", WORDS), null);
    assert.equal(findBannedWord("나쁜, 말", WORDS), null);
  });

  it("긴 말을 짧은 말보다 먼저 고릅니다", () => {
    assert.equal(findBannedWord("나쁜 말", ["말", "나쁜 말"]), "나쁜 말");
  });

  it("빈 말과 영문 대소문자는 정리합니다", () => {
    assert.equal(normalizeBannedWord("  Alpha   Beta  "), "alpha beta");
    assert.equal(findBannedWord("say ALPHA now", ["alpha"]), "alpha");
    assert.equal(findBannedWord("보통 문장", ["", "   "]), null);
  });
});
