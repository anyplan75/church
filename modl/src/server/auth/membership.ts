import type { Actor, Membership } from "@/server/auth/actor";

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

/**
 * 승인 대기이거나 다른 공동체 사람이면 정식 소속을 돌려주지 않습니다.
 * 계정 번호가 비어 있는 명부 줄은 여기 들어오지 않습니다. 그 줄은 로그인을 할 수 없습니다.
 */
export function formalMembership(actor: Actor, communityId: string): Membership | null {
  if (actor.kind !== "user") return null;
  if (actor.pendingCommunityIds.includes(communityId)) return null;
  return actor.memberships.find((item) => item.communityId === communityId) ?? null;
}

/** 가입 승인이 PENDING이면 정식 구성원 권한을 막습니다. */
export function assertApprovedMember(actor: Actor, communityId: string): Membership {
  const membership = formalMembership(actor, communityId);
  if (!membership) {
    throw new PermissionError("승인 대기 중이거나 이 공동체 구성원이 아니어서 정식 권한을 쓸 수 없습니다.");
  }
  return membership;
}

/** 테우리로 맡은 모들이거나, 지금 속한 모들이면 참입니다. */
export function memberCoversGroup(membership: Membership, groupId: string): boolean {
  return membership.leaderGroupIds.includes(groupId) || membership.currentGroupId === groupId;
}
