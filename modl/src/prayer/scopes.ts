/**
 * 기도 범위입니다. 토론과 같은 분류입니다.
 * 전체, 제주시, 서귀포시, 속한 교회, 속한 모들.
 * 제주도와 전국은 새 글에서 쓰지 않고, 예전 글은 전체로 봅니다.
 */

export const PRAYER_SCOPES = [
  { value: "all", label: "전체" },
  { value: "jeju_city", label: "제주시" },
  { value: "seogwipo", label: "서귀포시" },
  { value: "church", label: "교회" },
  { value: "gathering", label: "모들" },
] as const;

export type PrayerScope = (typeof PRAYER_SCOPES)[number]["value"];

const LEGACY = new Set(["jeju", "nation"]);

const LABELS = new Map<string, string>([
  ...PRAYER_SCOPES.map((scope) => [scope.value, scope.label] as const),
  ["jeju", "전체"],
  ["nation", "전체"],
]);

export function isPrayerScope(value: string): value is PrayerScope {
  return LABELS.has(value) && !LEGACY.has(value);
}

export function isStoredPrayerScope(value: string): boolean {
  return LABELS.has(value);
}

/** 화면에 보일 범위 이름입니다. 없는 예전 글에는 사람 호칭을 붙이지 않습니다. */
export function prayerScopeLabel(scope: string | null, visibility: string): string {
  if (scope && LABELS.has(scope)) return LABELS.get(scope) ?? "";
  if (visibility === "GROUP_ONLY") return "모들";
  if (visibility === "PUBLIC") return "전체";
  if (visibility === "PASTOR_ONLY") return "교회";
  return "";
}

/** 목록에서 고른 버튼과 맞출 키입니다. 제주도와 전국은 전체로 모읍니다. */
export function prayerScopeKey(input: { scope: string | null; churchId: string | null; groupId: string | null }): string {
  if (input.scope === "church" && input.churchId) return `church:${input.churchId}`;
  if (input.scope === "gathering" && input.groupId) return `gathering:${input.groupId}`;
  if (input.scope === "jeju_city" || input.scope === "seogwipo") return input.scope;
  return "all";
}

/** 고른 범위를 볼 수 있는지입니다. 범위가 없는 예전 글은 기존 공개 규칙을 그대로 둡니다. */
export function canSeePrayerScope(input: {
  scope: string | null;
  churchId: string | null;
  groupId: string | null;
  churchIds: ReadonlySet<string>;
  groupIds: ReadonlySet<string>;
  districts: ReadonlySet<string>;
}): boolean {
  if (!input.scope || input.scope === "all" || input.scope === "jeju" || input.scope === "nation") return true;
  if (input.scope === "gathering") return Boolean(input.groupId && input.groupIds.has(input.groupId));
  if (input.scope === "church") return Boolean(input.churchId && input.churchIds.has(input.churchId));
  if (input.scope === "seogwipo") return input.districts.has("서귀포시");
  if (input.scope === "jeju_city") return input.districts.has("제주시");
  return false;
}
