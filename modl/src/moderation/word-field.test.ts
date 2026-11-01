import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBannedWordField } from "@/moderation/word-field";

describe("금지어 쉼표 칸", () => {
  it("쉼표로 나누고 빈 칸과 중복은 버립니다", () => {
    const parsed = parseBannedWordField(" 알파 , 베타，알파,  ,감마 ");
    assert.deepEqual(parsed, { ok: true, words: ["알파", "베타", "감마"] });
  });

  it("칸이 비면 목록도 비웁니다", () => {
    assert.deepEqual(parseBannedWordField("  ,  "), { ok: true, words: [] });
  });

  it("한 조각이 40자를 넘으면 저장하지 않습니다", () => {
    const parsed = parseBannedWordField(`가, ${"나".repeat(41)}`);
    assert.equal(parsed.ok, false);
  });
});
