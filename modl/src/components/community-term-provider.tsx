"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { resolveLanguageMode } from "@/theme/resolve-term";
import type { LanguageMode } from "@/theme/types";

const STORAGE_KEY = "modl.languageMode";

type CommunityTermState = {
  languageMode: LanguageMode;
  overrides: unknown;
  setLanguageMode: (mode: LanguageMode) => void;
};

const CommunityTermContext = createContext<CommunityTermState | null>(null);

function readSavedMode(): LanguageMode {
  try {
    return resolveLanguageMode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "JEJU_DUAL";
  }
}

/**
 * 공동체 말투를 화면에 나눠 줍니다.
 * 1단계에서는 첫 화면에서 고른 말투를 이 브라우저에만 기억합니다.
 */
export function CommunityTermProvider({
  children,
  initialOverrides = {},
}: {
  children: React.ReactNode;
  initialOverrides?: unknown;
}) {
  const [languageMode, setLanguageModeState] = useState<LanguageMode>("JEJU_DUAL");
  const [overrides] = useState<unknown>(initialOverrides);

  useEffect(() => {
    setLanguageModeState(readSavedMode());
  }, []);

  const setLanguageMode = (mode: LanguageMode) => {
    setLanguageModeState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // 저장을 막아 둔 브라우저여도 이번 화면의 말투는 유지합니다.
    }
  };

  const value = useMemo(
    () => ({ languageMode, overrides, setLanguageMode }),
    [languageMode, overrides],
  );

  return <CommunityTermContext.Provider value={value}>{children}</CommunityTermContext.Provider>;
}

export function useCommunityTermState(): CommunityTermState {
  const value = useContext(CommunityTermContext);
  if (!value) {
    throw new Error("말투 제공자 안에서만 공동체 말을 쓸 수 있습니다.");
  }
  return value;
}
