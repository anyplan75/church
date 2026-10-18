import { cleanPath } from "@/lib/page-path";

const OPERATOR_APP_ID = "org.eunhye.worship.operator";
const MEMBER_APP_ID = "org.eunhye.worship.member";

type CapWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    config?: { appId?: string; appName?: string };
  };
};

function capacitor(): CapWindow["Capacitor"] | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as CapWindow).Capacitor;
}

/** Capacitor iOS/Android 네이티브 셸 안에 있는지 확인합니다. */
export function isNativeShell(): boolean {
  return Boolean(capacitor()?.isNativePlatform?.());
}

/** 조작 전용 Capacitor 앱인지 (기존 Remote). */
export function isMobileOperatorApp(): boolean {
  if (!isNativeShell()) return false;
  const id = nativeAppId();
  if (!id) return true;
  return id === OPERATOR_APP_ID || id !== MEMBER_APP_ID;
}

/** 성도용 Capacitor 앱인지. */
export function isMobileMemberApp(): boolean {
  if (!isNativeShell()) return false;
  return nativeAppId() === MEMBER_APP_ID;
}

export function nativeAppId(): string {
  const cap = capacitor();
  const fromConfig = String(cap?.config?.appId || "").trim();
  if (fromConfig) return fromConfig;
  try {
    const meta = typeof document !== "undefined" ? document.querySelector('meta[name="eunhye-app-id"]') : null;
    return String(meta?.getAttribute("content") || "").trim();
  } catch {
    return "";
  }
}

/** 모바일 Remote 앱의 첫 화면(슬라이드 리모컨). */
export const MOBILE_REMOTE_HOME = "/remote";

/** 성도 앱의 첫 화면. */
export const MOBILE_MEMBER_HOME = "/member";

/** 모바일 앱이면 셸에 맞는 홈, 아니면 넘긴 주소를 씁니다. */
export function operatorHome(fallback: string): string {
  if (isMobileMemberApp()) return MOBILE_MEMBER_HOME;
  return isMobileOperatorApp() ? MOBILE_REMOTE_HOME : fallback;
}

/** 조작 앱에서 열어 두는 경로. 그 밖은 리모컨으로 돌려보냅니다. */
export function isMobileOperatorPath(pathname: string): boolean {
  const path = cleanPath(pathname);
  if (path === "/login" || path === "/setup" || path === "/denied" || path === MOBILE_REMOTE_HOME) return true;
  if (/^\/services\/[^/]+\/live$/.test(path)) return true;
  return false;
}

/** 성도 앱에서 열어 두는 경로. */
export function isMobileMemberPath(pathname: string): boolean {
  const path = cleanPath(pathname);
  if (path === "/login" || path === "/setup" || path === "/denied") return true;
  if (path === MOBILE_MEMBER_HOME || path.startsWith(`${MOBILE_MEMBER_HOME}/`)) return true;
  return false;
}

export { OPERATOR_APP_ID, MEMBER_APP_ID };
