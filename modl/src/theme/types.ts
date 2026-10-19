import type { TermKey } from "@/theme/dictionary";

/** 화면이 말을 고르는 세 가지 방법입니다. */
export type LanguageMode = "JEJU_DUAL" | "JEJU_ONLY" | "STANDARD";

/**
 * 메뉴마다 제주어 두 가지 중 하나를 고르거나, 문구를 직접 바꿉니다.
 * select: primary 는 제주어 첫째 말, alt 는 제주어 둘째 말.
 * text: 그 칸의 문구를 통째로 바꿉니다.
 */
export type TermOverride =
  | { select: "primary" | "alt" }
  | { text: string; subtitle?: string; toast?: string };

export type CustomTermOverrides = Partial<Record<TermKey, TermOverride>>;

export type ResolvedTerm = {
  /** 크게 보여줄 말 */
  primary: string;
  /** 함께 보기 모드에서 작게 보여줄 표준어 */
  secondary?: string;
  /** 버튼을 누른 뒤 잠깐 보여주는 말 */
  toast?: string;
  /** 뜻을 풀어 주는 짧은 설명 */
  hint?: string;
};
