"use client";

import { useCommunityTermState } from "@/components/community-term-provider";
import type { TermKey } from "@/theme/dictionary";
import { resolveTerm } from "@/theme/resolve-term";
import type { ResolvedTerm } from "@/theme/types";

/** 화면에서 사전 키 하나의 말을 가져옵니다. */
export function useCommunityTerm(key: TermKey): ResolvedTerm {
  const { languageMode, overrides } = useCommunityTermState();
  return resolveTerm(key, { languageMode, overrides });
}
