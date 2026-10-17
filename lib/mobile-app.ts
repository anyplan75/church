import { cleanPath } from "@/lib/page-path";

/** Capacitor iOS/Android 네이티브 셸 안에 있는지 확인합니다. */
export function isMobileOperatorApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** 모바일 Remote 앱의 첫 화면(슬라이드 리모컨). */
export const MOBILE_REMOTE_HOME = "/remote";

/** 모바일 앱이면 항상 슬라이드 리모컨, 아니면 넘긴 주소를 씁니다. */
export function operatorHome(fallback: string): string {
  return isMobileOperatorApp() ? MOBILE_REMOTE_HOME : fallback;
}

/** 모바일에서 열어 두는 경로. 그 밖은 리모컨으로 돌려보냅니다. */
export function isMobileOperatorPath(pathname: string): boolean {
  const path = cleanPath(pathname);
  if (path === "/login" || path === "/setup" || path === "/denied" || path === MOBILE_REMOTE_HOME) return true;
  if (/^\/services\/[^/]+\/live$/.test(path)) return true;
  return false;
}
