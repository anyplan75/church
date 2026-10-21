import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canOpenPath, type Role } from "./roles.ts";
import { isMobileOperatorPath, MOBILE_REMOTE_HOME, OPERATOR_APP_ID, operatorHome } from "./mobile-app.ts";

describe("모바일 슬라이드 리모컨 경로", () => {
  it("로그인한 교회 사용자는 역할 없이 /remote 를 연다", () => {
    assert.equal(canOpenPath([] as Role[], MOBILE_REMOTE_HOME), true);
    assert.equal(canOpenPath(["view"] as Role[], MOBILE_REMOTE_HOME), true);
    assert.equal(canOpenPath(["admin"] as Role[], MOBILE_REMOTE_HOME), true);
  });

  it("모바일 허용 경로에 로그인·리모컨·권한없음이 들어간다", () => {
    assert.equal(isMobileOperatorPath("/login"), true);
    assert.equal(isMobileOperatorPath("/remote"), true);
    assert.equal(isMobileOperatorPath("/denied"), true);
    assert.equal(isMobileOperatorPath("/settings"), false);
    assert.equal(isMobileOperatorPath("/"), false);
  });

  it("조작 번들 id를 확인한다", () => {
    assert.equal(OPERATOR_APP_ID, "org.eunhye.worship.operator");
  });

  it("operatorHome 은 데스크톱 fallback 을 그대로 두고, 모바일이면 /remote 다", () => {
    // jsdom 없이 window/Capacitor 가 없으면 데스크톱으로 본다.
    assert.equal(operatorHome("/settings"), "/settings");
    assert.equal(operatorHome("/"), "/");
  });
});
