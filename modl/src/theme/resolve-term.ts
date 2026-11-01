import { z } from "zod";
import {
  TERM_DICTIONARY,
  type ActionKey,
  type LabelKey,
  type MenuKey,
  type RoleLabelKey,
  type TermKey,
} from "@/theme/dictionary";
import type { CustomTermOverrides, LanguageMode, ResolvedTerm, TermOverride } from "@/theme/types";

const languageModeSchema = z.enum(["JEJU_DUAL", "JEJU_ONLY", "STANDARD"]);

const termKeySchema = z.enum(
  [
    ...Object.keys(TERM_DICTIONARY.menus),
    ...Object.keys(TERM_DICTIONARY.actions),
    ...Object.keys(TERM_DICTIONARY.roles),
    ...Object.keys(TERM_DICTIONARY.labels),
  ] as [TermKey, ...TermKey[]],
);

const termOverrideSchema = z.union([
  z.object({ select: z.enum(["primary", "alt"]) }).strict(),
  z
    .object({
      text: z.string().min(1),
      subtitle: z.string().min(1).optional(),
      toast: z.string().min(1).optional(),
    })
    .strict(),
]);

const overridesSchema = z.record(termKeySchema, termOverrideSchema);

type FlatTerm = {
  standard: string;
  jeju: string;
  jejuAlt?: string;
  toast?: string;
  standardToast?: string;
  hint?: string;
};

function flattenMenus(): Record<MenuKey, FlatTerm> {
  const result = {} as Record<MenuKey, FlatTerm>;
  for (const key of Object.keys(TERM_DICTIONARY.menus) as MenuKey[]) {
    const entry = TERM_DICTIONARY.menus[key];
    result[key] = {
      standard: entry.standard,
      jeju: entry.jeju_primary,
      jejuAlt: entry.jeju_alt,
    };
  }
  return result;
}

function flattenActions(): Record<ActionKey, FlatTerm> {
  const result = {} as Record<ActionKey, FlatTerm>;
  for (const key of Object.keys(TERM_DICTIONARY.actions) as ActionKey[]) {
    const entry = TERM_DICTIONARY.actions[key];
    result[key] = {
      standard: entry.standard,
      jeju: entry.jeju,
      toast: "toast" in entry ? entry.toast : undefined,
      standardToast: "standardToast" in entry ? entry.standardToast : undefined,
      hint: "hint" in entry ? entry.hint : undefined,
    };
  }
  return result;
}

function flattenLabels(): Record<LabelKey, FlatTerm> {
  const result = {} as Record<LabelKey, FlatTerm>;
  for (const key of Object.keys(TERM_DICTIONARY.labels) as LabelKey[]) {
    const entry = TERM_DICTIONARY.labels[key];
    result[key] = {
      standard: entry.standard,
      jeju: entry.jeju,
    };
  }
  return result;
}

function flattenRoles(): Record<RoleLabelKey, FlatTerm> {
  const result = {} as Record<RoleLabelKey, FlatTerm>;
  for (const key of Object.keys(TERM_DICTIONARY.roles) as RoleLabelKey[]) {
    const entry = TERM_DICTIONARY.roles[key];
    result[key] = {
      standard: entry.standard,
      jeju: entry.jeju_primary,
      jejuAlt: "jeju_alt" in entry ? entry.jeju_alt : undefined,
    };
  }
  return result;
}

const FLAT_TERMS: Record<TermKey, FlatTerm> = {
  ...flattenMenus(),
  ...flattenActions(),
  ...flattenRoles(),
  ...flattenLabels(),
};

/**
 * 저장값이나 주소 값이 깨져 있으면 기본 말투인 제주어+표준어로 돌아갑니다.
 */
export function resolveLanguageMode(input: unknown): LanguageMode {
  const parsed = languageModeSchema.safeParse(input);
  return parsed.success ? parsed.data : "JEJU_DUAL";
}

/**
 * 공동체 덮어쓰기 칸을 읽습니다.
 * 모양이 하나라도 깨지면 덮어쓰기를 모두 버리고 기본 사전을 씁니다.
 */
export function parseTermOverrides(input: unknown): CustomTermOverrides {
  if (input == null) return {};
  const parsed = overridesSchema.safeParse(input);
  if (!parsed.success) return {};
  return parsed.data;
}

/** 저장 전에 씁니다. 깨진 값이면 null 이라서 화면에서 다시 적게 합니다. */
export function parseTermOverridesStrict(input: unknown): CustomTermOverrides | null {
  const parsed = overridesSchema.safeParse(input);
  if (!parsed.success) return null;
  return parsed.data;
}

function chooseToast(entry: FlatTerm, mode: LanguageMode, overrideToast?: string): string | undefined {
  if (overrideToast) return overrideToast;
  if (!entry.toast && !entry.standardToast) return undefined;
  if (mode === "STANDARD") return entry.standardToast ?? entry.toast;
  return entry.toast ?? entry.standardToast;
}

function chooseJeju(entry: FlatTerm, override: TermOverride | undefined): string {
  if (override && "select" in override && override.select === "alt" && entry.jejuAlt) {
    return entry.jejuAlt;
  }
  return entry.jeju;
}

/**
 * 서버와 화면이 같이 쓰는 말 고르기.
 * JEJU_DUAL: 제주어 큰 제목 + 표준어 작은 제목
 * JEJU_ONLY: 제주어만
 * STANDARD: 표준어만
 */
export function resolveTerm(
  key: TermKey,
  options: { languageMode: unknown; overrides?: unknown },
): ResolvedTerm {
  const languageMode = resolveLanguageMode(options.languageMode);
  const overrides = parseTermOverrides(options.overrides);
  const entry = FLAT_TERMS[key];
  const override = overrides[key];

  if (override && "text" in override) {
    return {
      primary: override.text,
      secondary: languageMode === "JEJU_DUAL" ? (override.subtitle ?? entry.standard) : undefined,
      toast: chooseToast(entry, languageMode, override.toast),
      hint: languageMode === "JEJU_ONLY" ? undefined : entry.hint,
    };
  }

  const jeju = chooseJeju(entry, override);

  if (languageMode === "STANDARD") {
    return {
      primary: entry.standard,
      toast: chooseToast(entry, languageMode),
      hint: entry.hint,
    };
  }

  if (languageMode === "JEJU_ONLY") {
    return {
      primary: jeju,
      toast: chooseToast(entry, languageMode),
    };
  }

  return {
    primary: jeju,
    secondary: entry.standard,
    toast: chooseToast(entry, languageMode),
    hint: entry.hint,
  };
}
