import { isChurchId } from "./platform";

/** 성도 앱 비로그인으로 고른 교회 id (브라우저에만 저장). */
export const GUEST_CHURCH_KEY = "church-worship-guest-church";

export function readGuestChurchId(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const id = String(localStorage.getItem(GUEST_CHURCH_KEY) || "").trim();
    return isChurchId(id) ? id : null;
  } catch {
    return null;
  }
}

export function persistGuestChurchId(id: string): void {
  if (typeof localStorage === "undefined") return;
  if (!isChurchId(id)) return;
  localStorage.setItem(GUEST_CHURCH_KEY, id);
}

export function clearGuestChurchId(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(GUEST_CHURCH_KEY);
}
