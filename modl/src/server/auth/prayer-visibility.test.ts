import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Actor, Membership, PrayerVisibility } from "@/server/auth/actor";
import { filterVisiblePrayers, toPrayerDto, visiblePrayerFilter, type PrayerRecord } from "@/server/auth/prayer-visibility";

function membership(extra: Partial<Membership> = {}): Membership {
  return {
    communityId: "community-a",
    memberId: "member-1",
    role: "MEMBER",
    currentGroupId: "group-1",
    leaderGroupIds: [],
    ...extra,
  };
}

function user(extra: Partial<Extract<Actor, { kind: "user" }>> = {}): Actor {
  return {
    kind: "user",
    userId: "user-1",
    memberships: [membership()],
    pendingCommunityIds: [],
    ...extra,
  };
}

function prayer(extra: Partial<PrayerRecord> = {}): PrayerRecord {
  return {
    id: "prayer-1",
    communityId: "community-a",
    memberId: "member-9",
    groupId: "group-1",
    content: "건강을 부탁드립니다",
    isAnonymous: false,
    visibility: "PUBLIC",
    prayTogetherCount: 0,
    createdAt: "2026-10-19T00:00:00.000Z",
    ...extra,
  };
}

function see(actor: Actor, visibility: PrayerVisibility, extra: Partial<PrayerRecord> = {}) {
  return visiblePrayerFilter(actor, prayer({ visibility, ...extra }));
}

describe("기도 공개 범위", () => {
  it("작성자 본인은 어떤 공개 범위든 자기 글을 봅니다", () => {
    const actor = user({ memberships: [membership({ role: "MEMBER", memberId: "member-9" })] });
    for (const visibility of ["PUBLIC", "GROUP_ONLY", "LEADER_ONLY", "PASTOR_ONLY"] as const) {
      assert.equal(see(actor, visibility, { memberId: "member-9" }), true);
    }
  });

  it("승인 대기 작성자도 자기 글은 보고 다른 공개 글은 못 봅니다", () => {
    const actor = user({
      memberships: [membership({ memberId: "member-9" })],
      pendingCommunityIds: ["community-a"],
    });
    assert.equal(see(actor, "PASTOR_ONLY", { memberId: "member-9" }), true);
    assert.equal(see(actor, "PUBLIC", { memberId: "member-2" }), false);
  });

  it("공개 글은 같은 공동체 구성원에게만 보입니다", () => {
    assert.equal(see(user(), "PUBLIC"), true);
    assert.equal(see({ kind: "guest" }, "PUBLIC"), false);
    const outsider = user({
      memberships: [membership({ communityId: "community-b" })],
    });
    assert.equal(see(outsider, "PUBLIC"), false);
  });

  it("모들 공개는 그 모들과 사역자, 그 모들 테우리만 봅니다", () => {
    assert.equal(see(user(), "GROUP_ONLY"), true);
    const otherGroup = user({ memberships: [membership({ currentGroupId: "group-2" })] });
    assert.equal(see(otherGroup, "GROUP_ONLY"), false);
    const pastor = user({ memberships: [membership({ role: "PASTOR", currentGroupId: null })] });
    assert.equal(see(pastor, "GROUP_ONLY"), true);
    const leader = user({
      memberships: [membership({ role: "CELL_LEADER", currentGroupId: null, leaderGroupIds: ["group-1"] })],
    });
    assert.equal(see(leader, "GROUP_ONLY"), true);
    const executive = user({ memberships: [membership({ role: "EXECUTIVE", currentGroupId: null })] });
    assert.equal(see(executive, "GROUP_ONLY"), false);
  });

  it("리더 전용은 그 모들 테우리와 사역자만 봅니다", () => {
    const leader = user({
      memberships: [
        membership({ role: "CELL_LEADER", currentGroupId: "group-2", leaderGroupIds: ["group-1"] }),
      ],
    });
    assert.equal(see(leader, "LEADER_ONLY", { groupId: "group-1" }), true);
    assert.equal(see(leader, "LEADER_ONLY", { groupId: "group-2" }), true);
    assert.equal(see(leader, "LEADER_ONLY", { groupId: "group-3" }), false);
    const pastor = user({ memberships: [membership({ role: "PASTOR" })] });
    assert.equal(see(pastor, "LEADER_ONLY"), true);
    const executive = user({ memberships: [membership({ role: "EXECUTIVE" })] });
    assert.equal(see(executive, "LEADER_ONLY"), false);
    assert.equal(see(user(), "LEADER_ONLY"), false);
  });

  it("사역자 전용은 사역자와 작성자만 봅니다", () => {
    const pastor = user({ memberships: [membership({ role: "PASTOR", memberId: "member-3" })] });
    assert.equal(see(pastor, "PASTOR_ONLY"), true);
    const executive = user({ memberships: [membership({ role: "EXECUTIVE" })] });
    assert.equal(see(executive, "PASTOR_ONLY"), false);
    assert.equal(see(user(), "PASTOR_ONLY"), false);
  });

  it("보이는 글만 골라 냅니다", () => {
    const actor = user();
    const rows = [
      prayer({ id: "open", visibility: "PUBLIC" }),
      prayer({ id: "secret", visibility: "PASTOR_ONLY" }),
    ];
    assert.deepEqual(
      filterVisiblePrayers(actor, rows).map((row) => row.id),
      ["open"],
    );
  });
});

describe("익명 응답", () => {
  it("익명이면 다른 사람 응답에서 작성자 번호를 뺍니다", () => {
    const dto = toPrayerDto(prayer({ isAnonymous: true, memberId: "member-9" }), user());
    assert.equal(dto.authorMemberId, null);
    assert.equal(dto.content, "건강을 부탁드립니다");
    assert.equal("memberId" in dto, false);
  });

  it("작성자 본인에게는 익명이어도 번호를 남깁니다", () => {
    const actor = user({ memberships: [membership({ memberId: "member-9" })] });
    const dto = toPrayerDto(prayer({ isAnonymous: true, memberId: "member-9" }), actor);
    assert.equal(dto.authorMemberId, "member-9");
  });

  it("익명이 아니면 작성자 번호를 그대로 둡니다", () => {
    const dto = toPrayerDto(prayer({ isAnonymous: false, memberId: "member-9" }), user());
    assert.equal(dto.authorMemberId, "member-9");
  });
});
