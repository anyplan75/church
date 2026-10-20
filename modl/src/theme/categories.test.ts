import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORY_LINKS } from "@/theme/categories";

describe("분류 메뉴", () => {
  it("이미 있는 일을 분류 안에 둡니다", () => {
    const found = new Map(CATEGORY_LINKS.map((item) => [item.label, item.href]));
    assert.equal(found.get("교인"), "/roster");
    assert.equal(found.get("출석"), "/attendance");
    assert.equal(found.get("주보"), "/bulletin");
    assert.equal(found.get("재정"), "/finance");
    assert.equal(found.get("승인"), "/approvals");
    assert.equal(found.get("QT"), "/qt");
    assert.equal(found.get("기도"), "/prayer");
    assert.equal(found.get("달력"), "/calendar");
    assert.equal(found.get("설문"), "/survey");
    assert.equal(found.get("회의록"), "/minutes");
    assert.equal(found.get("웹사이트"), "/website");
    assert.equal(found.get("지도"), "/map");
  });
});
