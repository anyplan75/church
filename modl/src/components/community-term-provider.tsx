"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { resolveLanguageMode } from "@/theme/resolve-term";
import type { LanguageMode } from "@/theme/types";

const STORAGE_KEY = "modl.languageMode";

type CommunityTermState = {
  languageMode: LanguageMode;
  overrides: unknown;
  setLanguageMode: (mode: LanguageMode) => void;
  languageLocked: boolean;
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
 * 공동체가 정해져 있으면 그 말투를 쓰고, 손님일 때만 이 브라우저에 고른 말투를 기억합니다.
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
  const [languageMode, setLanguageModeState] = useState<LanguageMode>(languageModeFromCommunity ?? "JEJU_DUAL");

  const overrides = useMemo(() => {
    try {
      return JSON.parse(overridesJson) as unknown;
    } catch {
      return {};
    }
  }, [overridesJson]);

  useEffect(() => {
    if (languageModeFromCommunity) {
      setLanguageModeState(languageModeFromCommunity);
      return;
    }
    setLanguageModeState(readSavedMode());
  }, [languageModeFromCommunity]);

  const setLanguageMode = useCallback(
    (mode: LanguageMode) => {
      if (languageModeFromCommunity) return;
      setLanguageModeState(mode);
      try {
        window.localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // 저장을 막아 둔 브라우저여도 이번 화면의 말투는 유지합니다.
      }
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
