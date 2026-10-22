"use client";

import { useState } from "react";
import { useCommunityTerm } from "@/components/use-community-term";

/**
 * 글 읽기 열쇠가 없을 때의 버튼입니다.
 * 누르면 같은 안내만 다시 보여 주고, 본문이나 질문을 채우지 않습니다.
 */
export function OcrKeyButton() {
  const term = useCommunityTerm("ocr_needs_key");
  const [note, setNote] = useState(term.primary);

  return (
    <div className="grid gap-2">
      <button
        type="button"
        data-testid="ocr-note"
        className="w-fit max-w-full whitespace-normal rounded-2xl bg-white px-4 py-3 text-left font-semibold leading-snug"
        onClick={() => setNote(term.primary)}
      >
        {term.primary}
      </button>
      <p className="leading-relaxed text-[#5c5148]">{note}</p>
    </div>
  );
}
