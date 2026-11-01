import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { letterRecipientLabel, nextPrayTogetherCount } from "@/prayer/rules";

describe("익명 기도의 기별 수신 이름", () => {
  it("익명이면 작성자 이름을 목록에 넣지 않습니다", () => {
    assert.equal(letterRecipientLabel({ isAnonymous: true, authorName: "이새식" }), null);
  });

  it("실명 글이면 작성자 이름을 보여 줍니다", () => {
    assert.equal(letterRecipientLabel({ isAnonymous: false, authorName: "김사역" }), "김사역");
  });
});

describe("함께 기도는 한 번만", () => {
  it("처음 누르면 1이 되고 다시 눌러도 그대로입니다", () => {
    const once = nextPrayTogetherCount(0, false);
    assert.equal(once, 1);
    assert.equal(nextPrayTogetherCount(once, true), 1);
  });
});
