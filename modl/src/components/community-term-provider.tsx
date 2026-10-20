"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LanguageMode } from "@/theme/types";

type CommunityTermState = {
  languageMode: LanguageMode;
  overrides: unknown;
  setLanguageMode: (mode: LanguageMode) => void;
  languageLocked: boolean;
};

const CommunityTermContext = createContext<CommunityTermState | null>(null);

/**
 * 공동체 이름을 화면에 나눠 줍니다.
 * 공동체가 정한 메뉴와 역할 이름만 그 말을 쓰고, 손님 화면은 표준어입니다.
 */
export function CommunityTermProvider({
  children,
  languageModeFromCommunity = null,
  overridesJson = "{}",
}: {
  children: React.ReactNode;
  languageModeFromCommunity?: LanguageMode | null;
  overridesJson?: string;
}) {
  const locked = languageModeFromCommunity != null;
  const [languageMode, setLanguageModeState] = useState<LanguageMode>(languageModeFromCommunity ?? "STANDARD");

  const overrides = useMemo(() => {
    try {
      return JSON.parse(overridesJson) as unknown;
    } catch {
      return {};
    }
  }, [overridesJson]);

  useEffect(() => {
    setLanguageModeState(languageModeFromCommunity ?? "STANDARD");
  }, [languageModeFromCommunity]);

  const setLanguageMode = useCallback(
    (mode: LanguageMode) => {
      if (languageModeFromCommunity) return;
      setLanguageModeState(mode);
    },
    [languageModeFromCommunity],
  );

  const value = useMemo(
    () => ({ languageMode, overrides, setLanguageMode, languageLocked: locked }),
    [languageMode, overrides, setLanguageMode, locked],
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
