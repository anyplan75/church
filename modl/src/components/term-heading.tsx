"use client";

import { useCommunityTerm } from "@/components/use-community-term";
import type { TermKey } from "@/theme/dictionary";

const LEVEL_CLASS = {
  1: "text-[clamp(1.6rem,1.2rem+1.4vw,2.4rem)]",
  2: "text-[clamp(1.25rem,1rem+0.8vw,1.8rem)]",
  3: "text-[clamp(1.05rem,0.95rem+0.4vw,1.35rem)]",
} as const;

/** 사전을 통과한 제목입니다. 글자가 커져도 줄바꿈되며 잘리지 않습니다. */
export function TermHeading({
  termKey,
  level = 2,
}: {
  termKey: TermKey;
  level?: 1 | 2 | 3;
}) {
  const term = useCommunityTerm(termKey);
  const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";

  return (
    <Tag className={`${LEVEL_CLASS[level]} font-semibold leading-snug text-balance text-[#241c16]`}>
      {term.primary}
    </Tag>
  );
}
