import { TERM_DICTIONARY, type MenuKey } from "@/theme/dictionary";

/** 껍데기 메뉴와 키보드 둘째 글자. g 다음에 이 글자를 누릅니다. */
export const MENU_ITEMS = [
  { key: "bulletin", shortcut: "b" },
  { key: "attendance", shortcut: "a" },
  { key: "group", shortcut: "m" },
  { key: "leader", shortcut: "t" },
  { key: "qt", shortcut: "q" },
  { key: "prayer", shortcut: "p" },
  { key: "prayer_letter", shortcut: "l" },
  { key: "calendar", shortcut: "c" },
  { key: "archive", shortcut: "r" },
  { key: "newcomer", shortcut: "n" },
  { key: "finance", shortcut: "f" },
  { key: "website", shortcut: "w" },
] as const satisfies readonly { key: MenuKey; shortcut: string }[];

export function isMenuKey(value: string): value is MenuKey {
  return Object.prototype.hasOwnProperty.call(TERM_DICTIONARY.menus, value);
}
