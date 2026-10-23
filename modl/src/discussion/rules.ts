/**
 * 토론 글이 보이는 곳입니다.
 * 지금 예배드리는 교회, 또는 지금 가는 모들에 속한 사람만 그 글을 봅니다.
 */

export type DiscussionPlaceKind = "church" | "gathering";

export type DiscussionPlace = {
  kind: DiscussionPlaceKind;
  id: string;
};

export function discussionPlacesFor(input: {
  currentChurchId: string | null;
  currentGroupId: string | null;
  followedChurchIds: ReadonlySet<string>;
  followedGroupIds: ReadonlySet<string>;
}): DiscussionPlace[] {
  const places: DiscussionPlace[] = [];
  if (input.currentChurchId && input.followedChurchIds.has(input.currentChurchId)) {
    places.push({ kind: "church", id: input.currentChurchId });
  }
  if (input.currentGroupId && input.followedGroupIds.has(input.currentGroupId)) {
    places.push({ kind: "gathering", id: input.currentGroupId });
  }
  return places;
}

export function canSeeDiscussionPost(
  post: { churchId: string | null; groupId: string | null },
  places: readonly DiscussionPlace[],
): boolean {
  return places.some((place) =>
    place.kind === "church" ? post.churchId === place.id && post.groupId == null : post.groupId === place.id && post.churchId == null,
  );
}

export function discussionPlaceFromRef(value: string, places: readonly DiscussionPlace[]): DiscussionPlace | null {
  const splitAt = value.indexOf(":");
  if (splitAt <= 0) return null;
  const kind = value.slice(0, splitAt);
  const id = value.slice(splitAt + 1);
  if (kind !== "church" && kind !== "gathering") return null;
  return places.find((place) => place.kind === kind && place.id === id) ?? null;
}
