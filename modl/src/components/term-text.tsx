"use client";

import { useCommunityTerm } from "@/components/use-community-term";
import type { TermKey } from "@/theme/dictionary";

/** 사전을 통과한 짧은 문구입니다. */
export function TermText({ termKey }: { termKey: TermKey }) {
  const term = useCommunityTerm(termKey);
  return <span className="leading-snug">{term.primary}</span>;
}
