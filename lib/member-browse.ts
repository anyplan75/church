import { cleanPath } from "./page-path";

/**
 * 성도 셸에서 로그인 없이 열어 두는 경로.
 * 예배정보·자막·광고·기도 UI·근처 교회 고르기. 쓰기는 화면 안에서만 가볍게 로그인 유도.
 */
export function isMemberBrowsePath(pathname: string): boolean {
  const path = cleanPath(pathname);
  if (path === "/member" || path.startsWith("/member/")) return true;
  if (path === "/community" || path.startsWith("/community/")) return true;
  if (path === "/prayers") return true;
  return false;
}
