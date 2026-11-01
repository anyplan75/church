import type { CSSProperties } from "react";

/** 켜진 교회 버튼입니다. */
export const CHOICE_BLUE = "#1d4ed8";
/** 켜진 모들 버튼입니다. */
export const CHOICE_PURPLE = "#6d28d9";
/** 제주시와 서귀포시가 같이 쓰는 지역 색입니다. */
export const CHOICE_REGION = "#0f766e";
/** 전체 버튼만 쓰는 색입니다. */
export const CHOICE_ALL = "#b45309";

export type ChoiceTone = "church" | "gathering" | "region" | "all";

export function choiceToneColor(tone: ChoiceTone): string {
  if (tone === "church") return CHOICE_BLUE;
  if (tone === "gathering") return CHOICE_PURPLE;
  if (tone === "all") return CHOICE_ALL;
  return CHOICE_REGION;
}

/** 높이는 글자 한 줄이고, 가로는 글자만큼만 둡니다. */
export const choiceButtonClass =
  "inline-flex w-fit max-w-full shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-px text-xs font-semibold leading-5";

/** 넓은 화면은 왼쪽부터 한 줄, 좁은 화면은 왼쪽 정렬로 아래로 쌓습니다. */
export const choiceRowClass = "flex w-full flex-col items-start gap-1.5 lg:flex-row lg:flex-wrap";

export function choiceButtonStyle(on: boolean, color: string): CSSProperties {
  return on
    ? { backgroundColor: color, borderColor: color, color: "#ffffff" }
    : { backgroundColor: "transparent", borderColor: color, color };
}
