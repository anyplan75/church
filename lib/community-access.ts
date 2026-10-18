/** 커뮤니티 화면·RTDB를 쓸 수 있는 로그인 사용자인지 */

export type CommunityActor = {
  kind: "platform" | "church";
  churchId: string | null;
};

/** 교회를 연 전체 운영자, 또는 교회 계정(모든 역할)이면 true */
export function canUseCommunity(user: CommunityActor | null | undefined): boolean {
  if (!user?.churchId) return false;
  return user.kind === "church" || user.kind === "platform";
}
