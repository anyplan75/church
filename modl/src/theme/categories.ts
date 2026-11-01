/** 첫 화면 대신 두는 분류 메뉴입니다. 문장은 표준어로 짧게 적습니다. */
export const CATEGORY_MENUS = [
  {
    label: "예배",
    items: [
      { href: "/attendance", label: "출석" },
      { href: "/bulletin", label: "주보" },
      { href: "/qt", label: "QT" },
      { href: "/prayer", label: "기도" },
      { href: "/calendar", label: "달력" },
      { href: "/quiz", label: "퀴즈" },
    ],
  },
  {
    label: "운영",
    items: [
      { href: "/finance", label: "재정" },
      { href: "/minutes", label: "회의록" },
      { href: "/archive", label: "행사자료" },
    ],
  },
  {
    label: "연결",
    items: [
      { href: "/website", label: "웹사이트" },
      { href: "/map", label: "지도" },
    ],
  },
] as const;

export const CATEGORY_LINKS = CATEGORY_MENUS.flatMap((group) => [...group.items]);
