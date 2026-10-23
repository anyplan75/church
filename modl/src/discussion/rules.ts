/**
 * 토론 글이 보이는 곳입니다.
 * 교회와 모들 글은 지금 그곳인 사람만 봅니다.
 * 제주 전체 글은 로그인한 사람이 보고, 익명을 고르면 이름을 보이지 않습니다.
 */

export type DiscussionPlaceKind = "church" | "gathering" | "jeju";

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
  post: { churchId: string | null; groupId: string | null; isJeju?: boolean },
  places: readonly DiscussionPlace[],
): boolean {
  if (post.isJeju) return post.churchId == null && post.groupId == null;
  return places.some((place) =>
    place.kind === "church" ? post.churchId === place.id && post.groupId == null : place.kind === "gathering" && post.groupId === place.id && post.churchId == null,
  );
}

export function discussionPlaceFromRef(value: string, places: readonly DiscussionPlace[]): DiscussionPlace | null {
  const splitAt = value.indexOf(":");
  if (splitAt <= 0) return null;
  const kind = value.slice(0, splitAt);
  const id = value.slice(splitAt + 1);
  if (kind !== "church" && kind !== "gathering" && kind !== "jeju") return null;
  return places.find((place) => place.kind === kind && place.id === id) ?? null;
}

/** 익명을 고르면 실명을 어디에도 돌려주지 않습니다. */
export function visibleAuthorName(input: { anonymous: boolean; name: string }): string {
  if (input.anonymous) return "익명";
  return input.name;
}
