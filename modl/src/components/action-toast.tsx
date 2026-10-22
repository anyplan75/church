"use client";

import { useCommunityTerm } from "@/components/use-community-term";
import type { ActionButtonKey } from "@/theme/dictionary";

/** 서버가 일을 끝낸 뒤에만 사전 토스트를 보여 줍니다. */
export function ActionToast({ termKey, testId }: { termKey: ActionButtonKey; testId: string }) {
  const term = useCommunityTerm(termKey);
  if (!term.toast) return null;
  return (
    <p role="status" data-testid={testId} className="rounded-2xl bg-[#241c16] px-4 py-3 leading-relaxed text-white">
      {term.toast}
    </p>
  );
}
