/** Capacitor iOS/Android 네이티브 셸 안에 있는지 확인합니다. */
export function isMobileOperatorApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}
