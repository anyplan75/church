import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSeeDiscussionPost, discussionScopeFromRef, discussionScopesFor, visibleAuthorName } from "@/discussion/rules";

const church = "church-1";
const otherChurch = "church-2";
const gathering = "group-1";

describe("토론 범위", () => {
  it("전체, 제주시, 서귀포시, 속한 교회와 모들 순으로 나열합니다", () => {
    const scopes = discussionScopesFor({ churchIds: [church, otherChurch], groupIds: [gathering] });
    assert.deepEqual(
      scopes.map((scope) => scope.kind),
      ["all", "jeju_city", "seogwipo", "church", "church", "gathering"],
    );
    assert.deepEqual(
      scopes.filter((scope) => scope.kind === "church").map((scope) => scope.id),
      [church, otherChurch],
    );
    assert.deepEqual(
      scopes.filter((scope) => scope.kind === "gathering").map((scope) => scope.id),
      [gathering],
    );
  });

  it("교회와 모들 글은 그곳만 보고, 지역과 전체는 로그인하면 봅니다", () => {
    const viewer = { churchIds: new Set([church]), groupIds: new Set([gathering]) };
    assert.equal(canSeeDiscussionPost({ scope: "church", churchId: church, groupId: null }, viewer), true);
    assert.equal(canSeeDiscussionPost({ scope: "church", churchId: otherChurch, groupId: null }, viewer), false);
    assert.equal(canSeeDiscussionPost({ scope: "gathering", churchId: null, groupId: gathering }, viewer), true);
    assert.equal(canSeeDiscussionPost({ scope: "gathering", churchId: null, groupId: "group-2" }, viewer), false);
    assert.equal(canSeeDiscussionPost({ scope: "seogwipo", churchId: null, groupId: null }, viewer), true);
    assert.equal(canSeeDiscussionPost({ scope: "jeju_city", churchId: null, groupId: null }, viewer), true);
    assert.equal(canSeeDiscussionPost({ scope: "all", churchId: null, groupId: null }, viewer), true);
    assert.equal(canSeeDiscussionPost({ scope: "jeju", churchId: null, groupId: null }, viewer), true);
    assert.equal(canSeeDiscussionPost({ scope: "seogwipo", churchId: church, groupId: null }, viewer), false);
    assert.equal(canSeeDiscussionPost({ churchId: null, groupId: null, isJeju: true }, viewer), true);
  });

  it("고른 범위에만 글을 올릴 수 있습니다", () => {
    const scopes = discussionScopesFor({ churchIds: [church], groupIds: [] });
    assert.deepEqual(discussionScopeFromRef(`church:${church}`, scopes), { kind: "church", id: church });
    assert.equal(discussionScopeFromRef(`gathering:${gathering}`, scopes), null);
    assert.deepEqual(discussionScopeFromRef("all:all", scopes), { kind: "all", id: "all" });
    assert.equal(discussionScopeFromRef("church", scopes), null);
  });

  it("익명이면 이름이 보이지 않습니다", () => {
    assert.equal(visibleAuthorName({ anonymous: true, name: "김목사" }), "익명");
    assert.equal(visibleAuthorName({ anonymous: true, name: "김목사" }).includes("김목사"), false);
    assert.equal(visibleAuthorName({ anonymous: false, name: "김목사" }), "김목사");
  });
});
