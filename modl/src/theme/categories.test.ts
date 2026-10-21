import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORY_LINKS } from "@/theme/categories";
import { sidebarHrefs } from "@/theme/menu-access";

describe("분류 메뉴", () => {
  it("이미 있는 일을 분류 안에 둡니다", () => {
    const found = new Map<string, string>(CATEGORY_LINKS.map((item) => [item.label, item.href]));
    assert.equal(found.get("출석"), "/attendance");
    assert.equal(found.get("주보"), "/bulletin");
    assert.equal(found.get("재정"), "/finance");
    assert.equal(found.get("QT"), "/qt");
    assert.equal(found.get("기도"), "/prayer");
    assert.equal(found.get("달력"), "/calendar");
    assert.equal(found.get("회의록"), "/minutes");
    assert.equal(found.get("행사자료"), "/archive");
    assert.equal(found.get("퀴즈"), "/quiz");
    assert.equal(found.get("웹사이트"), "/website");
    assert.equal(found.get("지도"), "/map");
    assert.equal(found.get("리더"), "/leader");
    assert.equal(found.get("교인"), undefined);
    assert.equal(found.get("승인"), undefined);
    assert.equal(found.get("설문"), undefined);
    assert.equal(found.get("기도 편지"), undefined);
    assert.equal(found.get("설정"), undefined);
  });

  it("손님은 지도만 보고 구성원은 퀴즈와 행사자료를 봅니다", () => {
    assert.deepEqual(sidebarHrefs({ formal: false, officer: false }), ["/map"]);
    const member = sidebarHrefs({ formal: true, officer: false });
    assert.equal(member.includes("/quiz"), true);
    assert.equal(member.includes("/archive"), true);
    assert.equal(member.includes("/finance"), false);
    assert.equal(member.includes("/survey"), false);
    const officer = sidebarHrefs({ formal: true, officer: true });
    assert.equal(officer.includes("/finance"), true);
  });
});
