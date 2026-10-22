/** 왼쪽 메뉴에 둘 주소입니다. 권한 밖 주소는 넣지 않습니다. */

const MEMBER_HREFS = [
  "/attendance",
  "/bulletin",
  "/qt",
  "/prayer",
  "/calendar",
  "/archive",
  "/quiz",
  "/leader",
  "/map",
] as const;

const OFFICER_HREFS = ["/finance", "/minutes", "/website"] as const;

export function sidebarHrefs(input: { formal: boolean; officer: boolean }): string[] {
  if (!input.formal) return ["/map"];
  if (!input.officer) return [...MEMBER_HREFS];
  return [...MEMBER_HREFS, ...OFFICER_HREFS];
}
