import { TERM_DICTIONARY, type TermKey } from "@/theme/dictionary";
import { resolveTerm } from "@/theme/resolve-term";
import type { ResolvedTerm } from "@/theme/types";

function isCommunityName(key: TermKey): boolean {
  return (
    Object.prototype.hasOwnProperty.call(TERM_DICTIONARY.menus, key) ||
    Object.prototype.hasOwnProperty.call(TERM_DICTIONARY.roles, key)
  );
}

/**
 * 화면에는 이름 하나만 보여 줍니다.
 * 제주어는 공동체가 정한 메뉴와 역할 이름에만 쓰고, 나머지 문장은 표준어입니다.
 */
export function termForScreen(
  key: TermKey,
  options: { languageMode: unknown; overrides?: unknown },
): ResolvedTerm {
  const term = resolveTerm(key, {
    languageMode: isCommunityName(key) ? options.languageMode : "STANDARD",
    overrides: options.overrides,
  });
  return { primary: term.primary, toast: term.toast };
}
