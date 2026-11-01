"use client";

import { useCommunityTermState } from "@/components/community-term-provider";
import type { TermKey } from "@/theme/dictionary";
import { termForScreen } from "@/theme/screen-term";
import type { ResolvedTerm } from "@/theme/types";

/** 화면 문장은 표준어이고, 메뉴와 역할만 공동체가 정한 이름을 씁니다. */
export function useCommunityTerm(key: TermKey): ResolvedTerm {
  const { languageMode, overrides } = useCommunityTermState();
  return termForScreen(key, { languageMode, overrides });
}
