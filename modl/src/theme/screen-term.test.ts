import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { termForScreen } from "@/theme/screen-term";

describe("화면 문장", () => {
  it("메뉴 이름은 공동체가 정한 말 하나만 보여 줍니다", () => {
    const term = termForScreen("bulletin", { languageMode: "JEJU_DUAL" });
    assert.equal(term.primary, "주일 기별");
    assert.equal(term.secondary, undefined);
    assert.equal(term.hint, undefined);
  });

  it("역할 이름 옆에는 풀이를 붙이지 않습니다", () => {
    const term = termForScreen("PASTOR", { languageMode: "JEJU_ONLY" });
    assert.equal(term.primary, "큰 테우리");
    assert.equal(term.secondary, undefined);
  });

  it("버튼과 안내 문장은 표준어로 짧게 나갑니다", () => {
    const term = termForScreen("check_in_btn", { languageMode: "JEJU_DUAL" });
    assert.equal(term.primary, "출석하기");
    assert.equal(term.toast, "오늘 출석을 기록했습니다.");
    assert.equal(term.secondary, undefined);
  });
});
