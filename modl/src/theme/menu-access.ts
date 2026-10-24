import { CATEGORY_LINKS } from "@/theme/categories";

/**
 * 왼쪽 메뉴에 둘 주소입니다.
 * 로그인하지 않은 손님에게는 메뉴를 보여 주고, 막힌 화면에서 로그인으로 안내합니다.
 * 구성원에게는 권한 밖 주소를 넣지 않습니다.
 */

const MEMBER_HREFS = [
  "/bulletin",
  "/qt",
  "/prayer",
  "/calendar",
  "/discussion",
  "/finance",
  "/minutes",
  "/archive",
  "/leader",
  "/map",
] as const;

const OFFICER_HREFS = [] as const;

export function sidebarHrefs(input: { formal: boolean; officer: boolean }): string[] {
  if (!input.formal) return CATEGORY_LINKS.map((item) => item.href);
  if (!input.officer) return [...MEMBER_HREFS];
  return [...MEMBER_HREFS, ...OFFICER_HREFS];
}
