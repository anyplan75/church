import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Actor, MemberRole, Membership } from "@/server/auth/actor";
import { PermissionError } from "@/server/auth/membership";
import { assertApprovedMember, assertCan, assertSameCommunity, can } from "@/server/auth/rbac";

const COMMUNITY = "community-a";
const OTHER = "community-b";

function membership(role: MemberRole, extra: Partial<Membership> = {}): Membership {
  return {
    communityId: COMMUNITY,
    memberId: "member-1",
    role,
    currentGroupId: "group-1",
    leaderGroupIds: role === "CELL_LEADER" ? ["group-1"] : [],
    ...extra,
  };
}

function user(role: MemberRole, extra: Partial<Actor & { kind: "user" }> = {}): Actor {
  return {
    kind: "user",
    userId: "user-1",
    memberships: [membership(role)],
    pendingCommunityIds: [],
    ...extra,
  };
}

const guest: Actor = { kind: "guest" };

describe("정식 구성원 가드", () => {
  it("승인 대기가 있으면 정식 권한을 주지 않습니다", () => {
    const actor = user("MEMBER", { pendingCommunityIds: [COMMUNITY] });
    assert.equal(can(actor, { type: "view_public_calendar", communityId: COMMUNITY }), false);
    assert.throws(() => assertApprovedMember(actor, COMMUNITY), PermissionError);
  });

  it("다른 공동체 승인 대기는 이 공동체 권한을 막지 않습니다", () => {
    const actor = user("MEMBER", { pendingCommunityIds: [OTHER] });
    assert.equal(can(actor, { type: "view_public_calendar", communityId: COMMUNITY }), true);
  });

  it("다른 공동체 자료는 거절합니다", () => {
    assert.throws(() => assertSameCommunity(COMMUNITY, OTHER), /다른 공동체/);
    assert.doesNotThrow(() => assertSameCommunity(COMMUNITY, COMMUNITY));
    const actor = user("PASTOR");
    assert.equal(can(actor, { type: "manage_finance", communityId: OTHER }), false);
  });
});

describe("역할별 권한", () => {
  it("사역자는 말투와 사용 등급, 사역자 전용 기도를 다룹니다", () => {
    const actor = user("PASTOR");
    assert.doesNotThrow(() => assertCan(actor, { type: "manage_plan_and_language", communityId: COMMUNITY }));
    assert.equal(can(actor, { type: "view_pastor_only_prayer", communityId: COMMUNITY }), true);
    assert.equal(can(actor, { type: "manage_finance", communityId: COMMUNITY }), true);
    assert.equal(
      can(actor, { type: "manage_group_attendance", communityId: COMMUNITY, groupId: "group-9" }),
      true,
    );
  });

  it("임원은 교적과 재정은 되고 사역자 전용은 안 됩니다", () => {
    const actor = user("EXECUTIVE");
    assert.equal(can(actor, { type: "manage_roster", communityId: COMMUNITY }), true);
    assert.equal(can(actor, { type: "publish_bulletin", communityId: COMMUNITY }), true);
    assert.equal(can(actor, { type: "view_attendance_stats", communityId: COMMUNITY }), true);
    assert.equal(can(actor, { type: "view_long_absent", communityId: COMMUNITY }), true);
    assert.equal(can(actor, { type: "manage_finance", communityId: COMMUNITY }), true);
    assert.equal(can(actor, { type: "manage_surveys_and_minutes", communityId: COMMUNITY }), true);
    assert.equal(can(actor, { type: "view_leader_calendar", communityId: COMMUNITY }), true);
    assert.equal(can(actor, { type: "manage_plan_and_language", communityId: COMMUNITY }), false);
    assert.equal(can(actor, { type: "view_pastor_only_prayer", communityId: COMMUNITY }), false);
    assert.throws(
      () => assertCan(actor, { type: "view_pastor_only_prayer", communityId: COMMUNITY }),
      PermissionError,
    );
  });

  it("모들 테우리는 맡은 모들과 지금 속한 모들만 다룹니다", () => {
    const actor = user("CELL_LEADER", {
      memberships: [
        membership("CELL_LEADER", {
          leaderGroupIds: ["group-1"],
          currentGroupId: "group-2",
        }),
      ],
    });
    assert.equal(
      can(actor, { type: "manage_group_posts", communityId: COMMUNITY, groupId: "group-1" }),
      true,
    );
    assert.equal(
      can(actor, { type: "manage_group_albums", communityId: COMMUNITY, groupId: "group-2" }),
      true,
    );
    assert.equal(
      can(actor, { type: "manage_group_attendance", communityId: COMMUNITY, groupId: "group-3" }),
      false,
    );
    assert.equal(can(actor, { type: "view_leader_calendar", communityId: COMMUNITY }), true);
    assert.equal(can(actor, { type: "manage_finance", communityId: COMMUNITY }), false);
    assert.equal(can(actor, { type: "view_long_absent", communityId: COMMUNITY }), false);
  });

  it("구성원과 새 괸당은 공개 범위와 본인 자리만 됩니다", () => {
    for (const role of ["MEMBER", "NEWCOMER"] as const) {
      const actor = user(role);
      assert.equal(can(actor, { type: "view_public_bulletin", communityId: COMMUNITY, isPublic: true }), true);
      assert.equal(can(actor, { type: "view_public_bulletin", communityId: COMMUNITY, isPublic: false }), false);
      assert.equal(
        can(actor, { type: "write_own_reflection", communityId: COMMUNITY, memberId: "member-1" }),
        true,
      );
      assert.equal(
        can(actor, { type: "write_own_reflection", communityId: COMMUNITY, memberId: "member-2" }),
        false,
      );
      assert.equal(can(actor, { type: "view_public_calendar", communityId: COMMUNITY }), true);
      assert.equal(can(actor, { type: "view_leader_calendar", communityId: COMMUNITY }), false);
      assert.equal(
        can(actor, { type: "view_own_group_page", communityId: COMMUNITY, groupId: "group-1" }),
        true,
      );
      assert.equal(
        can(actor, { type: "view_own_group_page", communityId: COMMUNITY, groupId: "group-9" }),
        false,
      );
      assert.equal(can(actor, { type: "manage_finance", communityId: COMMUNITY }), false);
      assert.equal(
        can(actor, { type: "write_prayer", communityId: COMMUNITY, visibility: "PUBLIC", groupId: null }),
        true,
      );
      assert.equal(
        can(actor, {
          type: "write_prayer",
          communityId: COMMUNITY,
          visibility: "GROUP_ONLY",
          groupId: "group-1",
        }),
        true,
      );
      assert.equal(
        can(actor, {
          type: "write_prayer",
          communityId: COMMUNITY,
          visibility: "LEADER_ONLY",
          groupId: "group-1",
        }),
        false,
      );
      assert.equal(
        can(actor, {
          type: "write_prayer",
          communityId: COMMUNITY,
          visibility: "PASTOR_ONLY",
          groupId: null,
        }),
        false,
      );
    }
  });

  it("마중 손님은 공개 기별 표식, 안뜨레, 문의, 익명 설문만 됩니다", () => {
    assert.equal(can(guest, { type: "view_bulletin_share_token", isPublic: true }), true);
    assert.equal(can(guest, { type: "view_bulletin_share_token", isPublic: false }), false);
    assert.equal(can(guest, { type: "view_open_website", communityId: COMMUNITY }), true);
    assert.equal(can(guest, { type: "submit_website_inquiry", communityId: COMMUNITY }), true);
    assert.equal(can(guest, { type: "answer_survey", communityId: COMMUNITY, allowAnonymous: true }), true);
    assert.equal(can(guest, { type: "answer_survey", communityId: COMMUNITY, allowAnonymous: false }), false);
    assert.equal(can(guest, { type: "view_public_calendar", communityId: COMMUNITY }), false);
    assert.equal(can(guest, { type: "manage_roster", communityId: COMMUNITY }), false);
    assert.equal(
      can(guest, { type: "write_prayer", communityId: COMMUNITY, visibility: "PUBLIC", groupId: null }),
      false,
    );
  });

  it("승인 대기 사용자는 손님처럼 익명 설문만 하고 구성원 일은 못 합니다", () => {
    const actor = user("MEMBER", { pendingCommunityIds: [COMMUNITY] });
    assert.equal(can(actor, { type: "answer_survey", communityId: COMMUNITY, allowAnonymous: true }), true);
    assert.equal(can(actor, { type: "answer_survey", communityId: COMMUNITY, allowAnonymous: false }), false);
    assert.equal(can(actor, { type: "view_public_bulletin", communityId: COMMUNITY, isPublic: true }), false);
  });

  it("사역자와 임원만 초대, 승인, 모들 편성을 합니다", () => {
    for (const role of ["PASTOR", "EXECUTIVE"] as const) {
      const actor = user(role);
      assert.equal(can(actor, { type: "issue_invite", communityId: COMMUNITY }), true);
      assert.equal(can(actor, { type: "review_approval", communityId: COMMUNITY }), true);
      assert.equal(can(actor, { type: "manage_groups", communityId: COMMUNITY }), true);
      assert.equal(can(actor, { type: "manage_roster", communityId: COMMUNITY }), true);
    }
    const leader = user("CELL_LEADER");
    assert.equal(can(leader, { type: "issue_invite", communityId: COMMUNITY }), false);
    assert.equal(can(leader, { type: "review_approval", communityId: COMMUNITY }), false);
    assert.equal(can(leader, { type: "manage_groups", communityId: COMMUNITY }), false);
    const member = user("MEMBER");
    assert.equal(can(member, { type: "review_approval", communityId: OTHER }), false);
    assert.equal(can(member, { type: "create_community" }), true);
    assert.equal(can(member, { type: "apply_to_join" }), true);
    assert.equal(can(guest, { type: "create_community" }), false);
    assert.equal(can(guest, { type: "apply_to_join" }), false);
    const pending = user("MEMBER", { pendingCommunityIds: [COMMUNITY] });
    assert.equal(can(pending, { type: "issue_invite", communityId: COMMUNITY }), false);
    assert.equal(can(pending, { type: "review_approval", communityId: COMMUNITY }), false);
  });

  it("모들 테우리는 자기 모들의 리더 기도만 쓸 수 있습니다", () => {
    const actor = user("CELL_LEADER");
    assert.equal(
      can(actor, {
        type: "write_prayer",
        communityId: COMMUNITY,
        visibility: "LEADER_ONLY",
        groupId: "group-1",
      }),
      true,
    );
    assert.equal(
      can(actor, {
        type: "write_prayer",
        communityId: COMMUNITY,
        visibility: "LEADER_ONLY",
        groupId: "group-8",
      }),
      false,
    );
  });
});
