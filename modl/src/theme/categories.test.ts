import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORY_LINKS, CATEGORY_MENUS } from "@/theme/categories";
import { sidebarHrefs } from "@/theme/menu-access";

describe("분류 메뉴", () => {
  it("이미 있는 일을 분류 안에 둡니다", () => {
    const found = new Map<string, string>(CATEGORY_LINKS.map((item) => [item.label, item.href]));
    assert.equal(found.get("출석"), undefined);
    assert.equal(found.get("안내"), "/bulletin");
    assert.equal(found.get("주보"), undefined);
    assert.equal(found.get("재정"), "/finance");
    assert.equal(found.get("QT"), "/qt");
    assert.equal(found.get("기도"), "/prayer");
    assert.equal(found.get("일정"), "/calendar");
    assert.equal(found.get("달력"), undefined);
    assert.equal(found.get("회의록"), "/minutes");
    assert.equal(found.get("행사자료"), "/archive");
    assert.equal(found.get("토론"), "/discussion");
    assert.equal(found.get("퀴즈"), undefined);
    assert.equal(found.get("웹사이트"), undefined);
    assert.equal(found.get("지도"), "/map");
    assert.equal(found.get("리더"), undefined);
    assert.equal(found.get("교인"), undefined);
    assert.equal(found.get("승인"), undefined);
    assert.equal(found.get("설문"), undefined);
    assert.equal(found.get("기도 편지"), undefined);
    assert.equal(found.get("설정"), undefined);
    assert.deepEqual(
      CATEGORY_MENUS.map((group) => [group.label, group.items.map((item) => item.label)]),
      [
        ["예배", ["안내", "QT", "기도", "일정", "토론"]],
        ["운영", ["재정", "회의록", "행사자료"]],
        ["연결", ["지도"]],
      ],
    );
  });

  it("손님은 기도와 지도를 포함하고, 구성원은 토론과 행사자료를 봅니다", () => {
    const guest = sidebarHrefs({ formal: false, officer: false });
    assert.equal(guest.includes("/prayer"), true);
    assert.equal(guest.includes("/map"), true);
    assert.equal(guest.includes("/attendance"), false);
    assert.equal(guest.includes("/calendar"), true);
    assert.equal(guest.includes("/finance"), true);
    assert.equal(guest.includes("/website"), false);
    const member = sidebarHrefs({ formal: true, officer: false });
    assert.equal(member.includes("/discussion"), true);
    assert.equal(member.includes("/quiz"), false);
    assert.equal(member.includes("/archive"), true);
    assert.equal(member.includes("/finance"), false);
    assert.equal(member.includes("/survey"), false);
    const officer = sidebarHrefs({ formal: true, officer: true });
    assert.equal(officer.includes("/finance"), true);
    assert.equal(officer.includes("/website"), false);
  });
});
