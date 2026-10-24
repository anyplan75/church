/**
 * 기도 범위입니다. 토론처럼 곳을 고르고, 사람 호칭은 쓰지 않습니다.
 * 데이터베이스에 접속하지 않습니다.
 */

export const PRAYER_SCOPES = [
  { value: "gathering", label: "모들" },
  { value: "church", label: "교회" },
  { value: "seogwipo", label: "서귀포시" },
  { value: "jeju_city", label: "제주시" },
  { value: "jeju", label: "제주도" },
  { value: "nation", label: "전국" },
] as const;

export type PrayerScope = (typeof PRAYER_SCOPES)[number]["value"];

const LABELS = new Map<string, string>(PRAYER_SCOPES.map((scope) => [scope.value, scope.label]));

export function isPrayerScope(value: string): value is PrayerScope {
  return LABELS.has(value);
}

/** 화면에 보일 범위 이름입니다. 없는 예전 글에는 사람 호칭을 붙이지 않습니다. */
export function prayerScopeLabel(scope: string | null, visibility: string): string {
  if (scope && LABELS.has(scope)) return LABELS.get(scope) ?? "";
  if (visibility === "GROUP_ONLY") return "모들";
  if (visibility === "PUBLIC") return "전국";
  if (visibility === "PASTOR_ONLY") return "교회";
  return "";
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
  if (!input.scope) return true;
  if (input.scope === "gathering") return Boolean(input.groupId && input.groupIds.has(input.groupId));
  if (input.scope === "church") return Boolean(input.churchId && input.churchIds.has(input.churchId));
  if (input.scope === "seogwipo") return input.districts.has("서귀포시");
  if (input.scope === "jeju_city") return input.districts.has("제주시");
  if (input.scope === "jeju" || input.scope === "nation") return true;
  return false;
}
