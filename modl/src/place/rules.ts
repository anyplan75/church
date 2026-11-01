/**
 * 교회와 모들 소속, 태우리 수정 권한입니다.
 * 화면에는 공동체를 두지 않습니다.
 */

export const CHURCH_PIN_COLOR = "#1d4ed8";
export const GATHERING_PIN_COLOR = "#7c3aed";

export type PlaceKind = "church" | "gathering";

export function placeSlug(kind: PlaceKind, id: string): string {
  const compact = id.replace(/-/g, "").slice(0, 12);
  return kind === "church" ? `c${compact}` : `g${compact}`;
}

export function canEditShared(input: { isSteward: boolean; granted: boolean }): boolean {
  return input.isSteward || input.granted;
}

/** 사역자가 교회나 모들의 관리자를 지정합니다. 이미 있어도 다시 지정할 수 있습니다. */
export function canAssignSteward(input: { isPastor: boolean }): boolean {
  return input.isPastor;
}

export function sharedRowVisible(
  row: { churchId: string | null; groupId: string | null },
  followedChurchIds: ReadonlySet<string>,
  followedGroupIds: ReadonlySet<string>,
): boolean {
  if (row.groupId) return followedGroupIds.has(row.groupId);
  if (row.churchId) return followedChurchIds.has(row.churchId);
  return false;
}

/** 교회나 모들에 아직 안 붙은 예전 줄은 그 저장소의 정식 구성원만 봅니다. */
export function legacyRowVisible(
  row: { churchId: string | null; groupId: string | null; communityId: string },
  formalCommunityIds: ReadonlySet<string>,
): boolean {
  if (row.churchId || row.groupId) return false;
  return formalCommunityIds.has(row.communityId);
}

export function canSeeSharedRow(
  row: { churchId: string | null; groupId: string | null; communityId: string },
  followedChurchIds: ReadonlySet<string>,
  followedGroupIds: ReadonlySet<string>,
  formalCommunityIds: ReadonlySet<string>,
): boolean {
  return sharedRowVisible(row, followedChurchIds, followedGroupIds) || legacyRowVisible(row, formalCommunityIds);
}
