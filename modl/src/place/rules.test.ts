import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHURCH_PIN_COLOR,
  GATHERING_PIN_COLOR,
  canAssignSteward,
  canEditShared,
  canSeeSharedRow,
  placeSlug,
} from "@/place/rules";

describe("교회와 모들 권한", () => {
  it("교회 핀 색은 그대로 두고 모들 핀 색은 다릅니다", () => {
    assert.equal(CHURCH_PIN_COLOR, "#1d4ed8");
    assert.notEqual(GATHERING_PIN_COLOR, CHURCH_PIN_COLOR);
    assert.equal(GATHERING_PIN_COLOR, "#7c3aed");
  });

  it("태우리와 수정 권한을 받은 사람만 고칩니다", () => {
    assert.equal(canEditShared({ isSteward: true, granted: false }), true);
    assert.equal(canEditShared({ isSteward: false, granted: true }), true);
    assert.equal(canEditShared({ isSteward: false, granted: false }), false);
  });

  it("만든 사람이 없을 때만 사역자가 태우리를 지정합니다", () => {
    assert.equal(canAssignSteward({ isPastor: true }), true);
    assert.equal(canAssignSteward({ isPastor: false }), false);
  });

  it("그 교회나 그 모들에 속한 사람만 자료를 봅니다", () => {
    const churches = new Set(["church-a"]);
    const groups = new Set(["group-a"]);
    const formal = new Set(["community-a"]);
    assert.equal(
      canSeeSharedRow({ churchId: "church-a", groupId: null, communityId: "community-a" }, churches, groups, formal),
      true,
    );
    assert.equal(
      canSeeSharedRow({ churchId: "church-b", groupId: null, communityId: "community-a" }, churches, groups, formal),
      false,
    );
    assert.equal(
      canSeeSharedRow({ churchId: null, groupId: "group-a", communityId: "community-a" }, churches, groups, formal),
      true,
    );
    assert.equal(
      canSeeSharedRow({ churchId: null, groupId: "group-b", communityId: "community-a" }, churches, groups, formal),
      false,
    );
    assert.equal(
      canSeeSharedRow({ churchId: null, groupId: null, communityId: "community-a" }, churches, groups, formal),
      true,
    );
    assert.equal(
      canSeeSharedRow({ churchId: null, groupId: null, communityId: "community-b" }, churches, groups, formal),
      false,
    );
  });

  it("공개 주소 이름은 교회와 모들이 다릅니다", () => {
    const id = "b79dece6-3243-48f5-9802-653fea00d715";
    assert.equal(placeSlug("church", id), "cb79dece63243");
    assert.equal(placeSlug("gathering", id), "gb79dece63243");
    assert.match(placeSlug("church", id), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});
