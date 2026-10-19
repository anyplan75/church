import { isNativeShell } from "@/lib/mobile-app";

/** Capacitor에서는 Next 클라이언트 RSC(`/…/index.txt`) 대신 HTML 전체를 다시 연다. */
export function appNavigate(path: string, router?: { replace: (href: string) => void; push?: (href: string) => void }, mode: "replace" | "push" = "replace") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const href = clean.endsWith("/") ? clean : `${clean}/`;
  // appId 메타만 있어도 하드 이동(브리지 준비 전 RSC 폴백 방지).
  if (isNativeShell()) {
    if (mode === "replace") window.location.replace(href);
    else window.location.assign(href);
    return;
  }
  if (mode === "push" && router?.push) router.push(href);
  else router?.replace(href);
}
