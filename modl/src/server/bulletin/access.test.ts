import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Actor, MemberRole } from "@/server/auth/actor";
import { can } from "@/server/auth/rbac";
import { bulletinsForActor, canPublishBulletin } from "@/server/bulletin/access";

const COMMUNITY = "community-1";
const OTHER = "community-2";

function user(role: MemberRole, communityId = COMMUNITY): Actor {
  return {
    kind: "user",
    userId: "user-1",
    pendingCommunityIds: [],
    memberships: [
      {
        communityId,
        memberId: "member-1",
        role,
        currentGroupId: null,
        leaderGroupIds: [],
      },
    ],
  };
}

const rows = [
  { id: "old", communityId: COMMUNITY, isPublic: true, worshipDate: "2026-10-04", sermonTitle: "지난 말씀", serviceLabel: "" },
  { id: "draft", communityId: COMMUNITY, isPublic: false, worshipDate: "2026-10-25", sermonTitle: "아직 비공개", serviceLabel: "" },
  { id: "new", communityId: COMMUNITY, isPublic: true, worshipDate: "2026-10-18", sermonTitle: "이번 말씀", serviceLabel: "주일 2부 예배" },
  { id: "other", communityId: OTHER, isPublic: true, worshipDate: "2026-10-25", sermonTitle: "다른 교회", serviceLabel: "" },
];

describe("주보 열람 권한", () => {
  it("교회 담당자만 주보를 만들고, 임원은 비공개 주보를 보기만 합니다", () => {
    const pastor = user("PASTOR");
    assert.equal(canPublishBulletin(pastor, COMMUNITY), true);
    assert.equal(can(pastor, { type: "view_public_bulletin", communityId: COMMUNITY, isPublic: false }), true);
    assert.deepEqual(bulletinsForActor(pastor, COMMUNITY, rows).map((row) => row.id), ["draft", "new", "old"]);
    const executive = user("EXECUTIVE");
    assert.equal(canPublishBulletin(executive, COMMUNITY), false);
    assert.equal(can(executive, { type: "view_public_bulletin", communityId: COMMUNITY, isPublic: false }), true);
    assert.deepEqual(bulletinsForActor(executive, COMMUNITY, rows).map((row) => row.id), ["draft", "new", "old"]);
  });

  it("구성원과 테우리는 발행된 주보만 보고 발행하지 못합니다", () => {
    for (const role of ["MEMBER", "NEWCOMER", "CELL_LEADER"] as const) {
      const actor = user(role);
      assert.equal(canPublishBulletin(actor, COMMUNITY), false);
      assert.equal(can(actor, { type: "publish_bulletin", communityId: COMMUNITY }), false);
      assert.deepEqual(
        bulletinsForActor(actor, COMMUNITY, rows).map((row) => row.id),
        ["new", "old"],
      );
    }
  });

  it("손님과 다른 공동체 주보는 목록에 나오지 않습니다", () => {
    const guest: Actor = { kind: "guest" };
    assert.deepEqual(bulletinsForActor(guest, COMMUNITY, rows), []);
    assert.equal(can(guest, { type: "view_bulletin_share_token", isPublic: true }), true);
    assert.equal(can(guest, { type: "view_bulletin_share_token", isPublic: false }), false);
    assert.equal(canPublishBulletin(user("PASTOR", OTHER), COMMUNITY), false);
    assert.deepEqual(bulletinsForActor(user("PASTOR"), OTHER, rows), []);
    assert.deepEqual(
      bulletinsForActor(user("PASTOR", OTHER), OTHER, rows).map((row) => row.sermonTitle),
      ["다른 교회"],
    );
  });

  it("승인 대기 중에는 발행된 주보도 정식으로 보지 못합니다", () => {
    const pending: Actor = {
      kind: "user",
      userId: "user-2",
      pendingCommunityIds: [COMMUNITY],
      memberships: [
        {
          communityId: COMMUNITY,
          memberId: "member-2",
          role: "MEMBER",
          currentGroupId: null,
          leaderGroupIds: [],
        },
      ],
    };
    assert.deepEqual(bulletinsForActor(pending, COMMUNITY, rows), []);
  });
});
