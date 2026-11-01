import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TERM_DICTIONARY } from "@/theme/dictionary";
import { parseTermOverrides, resolveLanguageMode, resolveTerm } from "@/server/theme/resolve-term";

describe("말투 고르기", () => {
  it("함께 보기는 제주어 큰 제목과 표준어 작은 제목입니다", () => {
    const term = resolveTerm("bulletin", { languageMode: "JEJU_DUAL" });
    assert.equal(term.primary, "주일 기별");
    assert.equal(term.secondary, "모바일 주보");
  });

  it("제주어만은 작은 제목을 뺍니다", () => {
    const term = resolveTerm("prayer", { languageMode: "JEJU_ONLY" });
    assert.equal(term.primary, "기도 수눌음");
    assert.equal(term.secondary, undefined);
  });

  it("표준어만은 표준 말과 표준 토스트를 씁니다", () => {
    const term = resolveTerm("check_in_btn", { languageMode: "STANDARD" });
    assert.equal(term.primary, "출석하기");
    assert.equal(term.secondary, undefined);
    assert.equal(term.toast, "오늘 출석을 기록했습니다.");
  });

  it("제주어 모드의 버튼은 제주 토스트를 씁니다", () => {
    const term = resolveTerm("grace_reaction_btn", { languageMode: "JEJU_DUAL" });
    assert.equal(term.primary, "은혜 쏨빡!");
    assert.equal(term.secondary, "은혜 나눔·아멘");
    assert.equal(term.toast, TERM_DICTIONARY.actions.grace_reaction_btn.toast);
  });

  it("둘째 제주어를 고르면 그 말로 바꿉니다", () => {
    const term = resolveTerm("group", {
      languageMode: "JEJU_ONLY",
      overrides: { group: { select: "alt" } },
    });
    assert.equal(term.primary, "구들");
  });

  it("둘째 말이 없는 호칭은 첫째 제주어를 유지합니다", () => {
    const term = resolveTerm("EXECUTIVE", {
      languageMode: "JEJU_DUAL",
      overrides: { EXECUTIVE: { select: "alt" } },
    });
    assert.equal(term.primary, "살림꾼");
    assert.equal(term.secondary, "임원");
  });

  it("직접 문구는 사전 말을 덮습니다", () => {
    const term = resolveTerm("website", {
      languageMode: "JEJU_DUAL",
      overrides: { website: { text: "우리 마당", subtitle: "소개 집" } },
    });
    assert.equal(term.primary, "우리 마당");
    assert.equal(term.secondary, "소개 집");
  });

  it("보고픈 괸당은 제주어 제목과 설명을 함께 보여 줍니다", () => {
    const term = resolveTerm("long_term_absentee", { languageMode: "JEJU_DUAL" });
    assert.equal(term.primary, "보고픈 괸당");
    assert.equal(term.secondary, "장기 결석자 알림");
    assert.equal(term.hint, "오랫동안 얼굴을 보지 못해 안부가 궁금한 식구 목록");
    const only = resolveTerm("long_term_absentee", { languageMode: "JEJU_ONLY" });
    assert.equal(only.hint, undefined);
  });

  it("역할 호칭도 같은 규칙을 탑니다", () => {
    const pastor = resolveTerm("PASTOR", { languageMode: "JEJU_DUAL" });
    assert.equal(pastor.primary, "큰 테우리");
    assert.equal(pastor.secondary, "사역자");
    const guest = resolveTerm("GUEST", { languageMode: "STANDARD" });
    assert.equal(guest.primary, "외부 방문자");
    const waiting = resolveTerm("UNREGISTERED", { languageMode: "JEJU_ONLY" });
    assert.equal(waiting.primary, "기다리는 괸당");
  });

  it("알 수 없는 말투 값은 함께 보기로 돌아갑니다", () => {
    assert.equal(resolveLanguageMode("NOPE"), "JEJU_DUAL");
    const term = resolveTerm("qt", { languageMode: "???" });
    assert.equal(term.primary, "말씀 트멍");
    assert.equal(term.secondary, "매일 묵상");
  });
});

describe("덮어쓰기 파싱", () => {
  it("빈 값과 올바른 모양은 통과합니다", () => {
    assert.deepEqual(parseTermOverrides(undefined), {});
    assert.deepEqual(parseTermOverrides(null), {});
    assert.deepEqual(parseTermOverrides({}), {});
    assert.deepEqual(parseTermOverrides({ bulletin: { select: "primary" } }), {
      bulletin: { select: "primary" },
    });
  });

  it("깨진 모양은 기본 사전으로 돌아갑니다", () => {
    assert.deepEqual(parseTermOverrides("주보"), {});
    assert.deepEqual(parseTermOverrides(["bulletin"]), {});
    assert.deepEqual(parseTermOverrides({ bulletin: { select: "middle" } }), {});
    assert.deepEqual(parseTermOverrides({ bulletin: { text: "" } }), {});
    assert.deepEqual(parseTermOverrides({ bulletin: { select: "alt", text: "둘 다" } }), {});
    assert.deepEqual(parseTermOverrides({ not_a_menu: { select: "alt" } }), {});
  });

  it("깨진 덮어쓰기가 있어도 화면 말은 사전 그대로입니다", () => {
    const term = resolveTerm("finance", {
      languageMode: "JEJU_ONLY",
      overrides: { finance: { text: "" } },
    });
    assert.equal(term.primary, "공동체 살림");
  });
});
