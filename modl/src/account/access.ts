import type { MemberRole } from "@/server/auth/actor";

/** 교회 목록과 금지어는 사역자 계정에서만 엽니다. */
export function showsCommunitySettings(role: MemberRole | null): boolean {
  return role === "PASTOR";
}

/** 가입자 목록은 사역자 계정에서만 엽니다. 임원과 일반 회원은 보지 않습니다. */
export function showsSignupList(role: MemberRole | null): boolean {
  return role === "PASTOR";
}

/** 교인, 모임, 초대, 새가족, 승인은 사역자와 임원 계정에서만 엽니다. */
export function showsPeopleSettings(role: MemberRole | null): boolean {
  return role === "PASTOR" || role === "EXECUTIVE";
}

/** 데리러 가기 주소 동의는 공동체에 속한 본인 계정에만 둡니다. */
export function showsOwnPickup(role: MemberRole | null): boolean {
  return role !== null;
}
