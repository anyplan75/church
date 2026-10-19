/**
 * 서버 전용 권한 검사입니다.
 * 화면 코드에서 이 파일을 부르지 마세요. 권한은 서버에서만 결정합니다.
 *
 * 역할
 * - PASTOR: 그 공동체의 모든 일. 사역자 전용 기도, 말투, 사용 등급 포함.
 * - EXECUTIVE: 교적, 주보 발행, 출석 통계, 보고픈 괸당, 재정, 설문·회의록, 리더 일정.
 *   사역자 전용 기도는 볼 수 없습니다.
 * - CELL_LEADER: 자신이 맡은 모들, 또는 지금 속한 모들의 출석·게시·사진.
 *   리더 전용 기도는 그 모들만. 리더 일정은 볼 수 있습니다.
 * - MEMBER, NEWCOMER: 공개 주보, 본인 묵상, 공개 범위 안의 기도, 공개 일정, 본인 모들.
 * - GUEST: 공개 주보 나누기 표식, 열린 안뜨레, 방문 문의, 이름 없이 답할 수 있는 설문.
 */

import type { Actor, MemberRole, PrayerVisibility } from "@/server/auth/actor";
import { assertApprovedMember, formalMembership, memberCoversGroup, PermissionError } from "@/server/auth/membership";

export type AppAction =
  | { type: "manage_plan_and_language"; communityId: string }
  | { type: "manage_roster"; communityId: string }
  | { type: "publish_bulletin"; communityId: string }
  | { type: "view_public_bulletin"; communityId: string; isPublic: boolean }
  | { type: "view_bulletin_share_token"; isPublic: boolean }
  | { type: "view_attendance_stats"; communityId: string }
  | { type: "view_long_absent"; communityId: string }
  | { type: "manage_finance"; communityId: string }
  | { type: "manage_surveys_and_minutes"; communityId: string }
  | { type: "view_leader_calendar"; communityId: string }
  | { type: "manage_group_attendance"; communityId: string; groupId: string }
  | { type: "manage_group_posts"; communityId: string; groupId: string }
  | { type: "manage_group_albums"; communityId: string; groupId: string }
  | { type: "view_pastor_only_prayer"; communityId: string }
  | { type: "write_own_reflection"; communityId: string; memberId: string }
  | {
      type: "write_prayer";
      communityId: string;
      visibility: PrayerVisibility;
      groupId: string | null;
    }
  | { type: "view_public_calendar"; communityId: string }
  | { type: "view_own_group_page"; communityId: string; groupId: string }
  | { type: "view_open_website"; communityId: string }
  | { type: "submit_website_inquiry"; communityId: string }
  | { type: "answer_survey"; communityId: string; allowAnonymous: boolean }
  | { type: "create_community" }
  | { type: "apply_to_join" }
  | { type: "issue_invite"; communityId: string }
  | { type: "review_approval"; communityId: string }
  | { type: "manage_groups"; communityId: string };

const ROSTER_ROLES = ["PASTOR", "EXECUTIVE"] as const satisfies readonly MemberRole[];
const LEADER_CALENDAR_ROLES = ["PASTOR", "EXECUTIVE", "CELL_LEADER"] as const satisfies readonly MemberRole[];

function roleIs(actor: Actor, communityId: string, roles: readonly MemberRole[]): boolean {
  const membership = formalMembership(actor, communityId);
  return Boolean(membership && roles.includes(membership.role));
}

function canManageGroup(actor: Actor, communityId: string, groupId: string): boolean {
  const membership = formalMembership(actor, communityId);
  if (!membership) return false;
  if (membership.role === "PASTOR") return true;
  if (membership.role !== "CELL_LEADER") return false;
  return memberCoversGroup(membership, groupId);
}

function canViewGroupPage(actor: Actor, communityId: string, groupId: string): boolean {
  const membership = formalMembership(actor, communityId);
  if (!membership) return false;
  if (membership.role === "PASTOR") return true;
  if (membership.role === "CELL_LEADER" && memberCoversGroup(membership, groupId)) return true;
  return membership.currentGroupId === groupId;
}

function canWritePrayer(actor: Actor, action: Extract<AppAction, { type: "write_prayer" }>): boolean {
  const membership = formalMembership(actor, action.communityId);
  if (!membership) return false;

  switch (action.visibility) {
    case "PUBLIC":
      return true;
    case "GROUP_ONLY":
      if (!action.groupId) return false;
      if (membership.role === "PASTOR") return true;
      if (membership.role === "CELL_LEADER" && memberCoversGroup(membership, action.groupId)) return true;
      return membership.currentGroupId === action.groupId;
    case "LEADER_ONLY":
      if (!action.groupId) return false;
      if (membership.role === "PASTOR") return true;
      return membership.role === "CELL_LEADER" && memberCoversGroup(membership, action.groupId);
    case "PASTOR_ONLY":
      return membership.role === "PASTOR";
    default: {
      const neverVisibility: never = action.visibility;
      return neverVisibility;
    }
  }
}

/** 이 사람이 이 일을 할 수 있는지 참/거짓으로 돌려줍니다. */
export function can(actor: Actor, action: AppAction): boolean {
  switch (action.type) {
    case "manage_plan_and_language":
      return roleIs(actor, action.communityId, ["PASTOR"]);
    case "manage_roster":
    case "issue_invite":
    case "review_approval":
    case "manage_groups":
    case "publish_bulletin":
    case "view_attendance_stats":
    case "view_long_absent":
    case "manage_finance":
    case "manage_surveys_and_minutes":
      return roleIs(actor, action.communityId, ROSTER_ROLES);
    case "create_community":
    case "apply_to_join":
      return actor.kind === "user";
    case "view_public_bulletin": {
      const membership = formalMembership(actor, action.communityId);
      if (!membership) return false;
      if (action.isPublic) return true;
      return membership.role === "PASTOR" || membership.role === "EXECUTIVE";
    }
    case "view_bulletin_share_token":
      return action.isPublic;
    case "view_leader_calendar":
      return roleIs(actor, action.communityId, LEADER_CALENDAR_ROLES);
    case "manage_group_attendance":
    case "manage_group_posts":
    case "manage_group_albums":
      return canManageGroup(actor, action.communityId, action.groupId);
    case "view_pastor_only_prayer":
      return roleIs(actor, action.communityId, ["PASTOR"]);
    case "write_own_reflection": {
      const membership = formalMembership(actor, action.communityId);
      return Boolean(membership && membership.memberId === action.memberId);
    }
    case "write_prayer":
      return canWritePrayer(actor, action);
    case "view_public_calendar":
      return formalMembership(actor, action.communityId) !== null;
    case "view_own_group_page":
      return canViewGroupPage(actor, action.communityId, action.groupId);
    case "view_open_website":
    case "submit_website_inquiry":
      return true;
    case "answer_survey":
      if (formalMembership(actor, action.communityId)) return true;
      return action.allowAnonymous;
    default: {
      const neverAction: never = action;
      return neverAction;
    }
  }
}

/** 권한이 없으면 한국어 오류를 던집니다. */
export function assertCan(actor: Actor, action: AppAction): void {
  if (!can(actor, action)) {
    throw new PermissionError("이 일에는 권한이 없습니다.");
  }
}

/** 불러온 자료의 공동체 번호가 다르면 거절합니다. */
export function assertSameCommunity(leftCommunityId: string, rightCommunityId: string): void {
  if (leftCommunityId !== rightCommunityId) {
    throw new PermissionError("다른 공동체의 자료는 열 수 없습니다.");
  }
}

export { assertApprovedMember, formalMembership, PermissionError };
