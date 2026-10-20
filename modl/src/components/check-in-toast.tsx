"use client";

import { useCommunityTerm } from "@/components/use-community-term";

/** 서버가 출석을 남긴 뒤에만 사전 토스트를 보여 줍니다. */
export function CheckInToast() {
  const term = useCommunityTerm("check_in_btn");
  if (!term.toast) return null;
  return (
    <p role="status" data-testid="check-in-toast" className="rounded-2xl bg-[#241c16] px-4 py-3 leading-relaxed text-white">
      {term.toast}
    </p>
  );
}
