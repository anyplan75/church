import { MENU_ITEMS } from "@/theme/menus";

/**
 * 물리 키보드로 메뉴를 옮기는 규칙입니다.
 * 첫 글자 g 다음에 메뉴 글자를 누릅니다. 홈은 h 입니다.
 * 업무 단축키 전체를 여기에 넣지 않습니다.
 */
export function resolveMenuShortcut(firstKey: string, secondKey: string): string | null {
  if (firstKey.toLowerCase() !== "g") return null;
  const key = secondKey.toLowerCase();
  if (key === "h") return "/";
  const found = MENU_ITEMS.find((item) => item.shortcut === key);
  return found ? `/${found.key}` : null;
}
