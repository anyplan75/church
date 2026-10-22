"use client";

import { useEffect, useState } from "react";
import { useCommunityTerm } from "@/components/use-community-term";
import type { ActionButtonKey } from "@/theme/dictionary";

/** 사전을 통과한 버튼입니다. 누르면 그 말투의 짧은 안내를 보여 줍니다. */
export function TermButton({
  termKey,
  onPress,
  testId,
  toastOnPress = true,
  submitFormId,
}: {
  termKey: ActionButtonKey;
  onPress?: () => void;
  testId?: string;
  toastOnPress?: boolean;
  submitFormId?: string;
}) {
  const term = useCommunityTerm(termKey);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="grid gap-2">
      <button
        type="button"
        data-testid={testId}
        className="rounded-2xl bg-[#1d6b45] px-4 py-3 text-left text-white"
        onClick={() => {
          onPress?.();
          if (submitFormId) {
            const form = document.getElementById(submitFormId);
            if (form instanceof HTMLFormElement) form.requestSubmit();
          }
          if (toastOnPress && term.toast) setToast(term.toast);
        }}
      >
        <span className="block text-[clamp(1rem,0.95rem+0.25vw,1.2rem)] font-semibold leading-snug">
          {term.primary}
        </span>
      </button>
      {toast ? (
        <p role="status" className="rounded-2xl bg-[#241c16] px-4 py-3 leading-relaxed text-white">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
