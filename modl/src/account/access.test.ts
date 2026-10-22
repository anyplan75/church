import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { showsCommunitySettings, showsOwnPickup, showsPeopleSettings, showsSignupList } from "@/account/access";

describe("계정 설정 범위", () => {
  it("사역자만 공동체 설정을 보고 다른 역할은 보지 않습니다", () => {
    assert.equal(showsCommunitySettings("PASTOR"), true);
    assert.equal(showsCommunitySettings("EXECUTIVE"), false);
    assert.equal(showsCommunitySettings("CELL_LEADER"), false);
    assert.equal(showsCommunitySettings("MEMBER"), false);
    assert.equal(showsCommunitySettings("NEWCOMER"), false);
    assert.equal(showsCommunitySettings(null), false);
  });

  it("사역자만 가입자 목록을 보고 다른 역할은 보지 않습니다", () => {
    assert.equal(showsSignupList("PASTOR"), true);
    assert.equal(showsSignupList("EXECUTIVE"), false);
    assert.equal(showsSignupList("CELL_LEADER"), false);
    assert.equal(showsSignupList("MEMBER"), false);
    assert.equal(showsSignupList("NEWCOMER"), false);
    assert.equal(showsSignupList(null), false);
  });

  it("사역자와 임원만 사람 설정을 봅니다", () => {
    assert.equal(showsPeopleSettings("PASTOR"), true);
    assert.equal(showsPeopleSettings("EXECUTIVE"), true);
    assert.equal(showsPeopleSettings("CELL_LEADER"), false);
    assert.equal(showsPeopleSettings("MEMBER"), false);
    assert.equal(showsPeopleSettings(null), false);
  });

  it("본인 계정만 데리러 가기 동의를 보고 손님은 보지 않습니다", () => {
    assert.equal(showsOwnPickup("PASTOR"), true);
    assert.equal(showsOwnPickup("EXECUTIVE"), true);
    assert.equal(showsOwnPickup("CELL_LEADER"), true);
    assert.equal(showsOwnPickup("MEMBER"), true);
    assert.equal(showsOwnPickup("NEWCOMER"), true);
    assert.equal(showsOwnPickup(null), false);
  });
});
