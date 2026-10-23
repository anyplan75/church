import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSeeDiscussionPost, discussionPlaceFromRef, discussionPlacesFor } from "@/discussion/rules";

const church = "church-1";
const otherChurch = "church-2";
const gathering = "group-1";

describe("토론이 보이는 곳", () => {
  it("지금 예배드리는 교회와 지금 가는 모들만 고릅니다", () => {
    const places = discussionPlacesFor({
      currentChurchId: church,
      currentGroupId: gathering,
      followedChurchIds: new Set([church, otherChurch]),
      followedGroupIds: new Set([gathering]),
    });
    assert.deepEqual(places, [
      { kind: "church", id: church },
      { kind: "gathering", id: gathering },
    ]);
  });

  it("구독만 하고 지금 고르지 않은 교회 글은 보이지 않습니다", () => {
    const places = discussionPlacesFor({
      currentChurchId: church,
      currentGroupId: null,
      followedChurchIds: new Set([church, otherChurch]),
      followedGroupIds: new Set([gathering]),
    });
    assert.equal(canSeeDiscussionPost({ churchId: church, groupId: null }, places), true);
    assert.equal(canSeeDiscussionPost({ churchId: otherChurch, groupId: null }, places), false);
    assert.equal(canSeeDiscussionPost({ churchId: null, groupId: gathering }, places), false);
  });

  it("고른 곳에만 글을 올릴 수 있습니다", () => {
    const places = discussionPlacesFor({
      currentChurchId: church,
      currentGroupId: null,
      followedChurchIds: new Set([church]),
      followedGroupIds: new Set(),
    });
    assert.deepEqual(discussionPlaceFromRef(`church:${church}`, places), { kind: "church", id: church });
    assert.equal(discussionPlaceFromRef(`gathering:${gathering}`, places), null);
    assert.equal(discussionPlaceFromRef("church", places), null);
  });
});
