/**
 * 누가 요청했는지 담는 모양입니다.
 *
 * 앱 역할은 다섯 가지뿐입니다.
 * 미가입 명부는 역할이 아니라, 회원 줄의 계정 번호가 비어 있는 상태입니다.
 * 마중 손님(GUEST)은 로그인하지 않은 요청이며 회원 줄이 아닙니다.
 */

export const MEMBER_ROLES = ["PASTOR", "EXECUTIVE", "CELL_LEADER", "MEMBER", "NEWCOMER"] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export type PrayerVisibility = "PUBLIC" | "GROUP_ONLY" | "LEADER_ONLY" | "PASTOR_ONLY";

/** 한 공동체 안에서의 정식 소속입니다. */
export type Membership = {
  communityId: string;
  memberId: string;
  role: MemberRole;
  /** 지금 속한 모들. 없으면 null */
  currentGroupId: string | null;
  /** 이 사람이 테우리로 맡은 모들 */
  leaderGroupIds: readonly string[];
};

export type Actor =
  | { kind: "guest" }
  | {
      kind: "user";
      userId: string;
      memberships: readonly Membership[];
      /**
       * 가입 승인이 아직 대기인 공동체.
       * 여기에 들어 있으면 그 공동체에서는 정식 구성원 권한을 주지 않습니다.
       */
      pendingCommunityIds: readonly string[];
    };
