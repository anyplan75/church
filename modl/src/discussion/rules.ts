/**
 * 토론 범위입니다.
 * 서귀포시, 제주시, 제주도, 전체 교회는 로그인한 사람이 봅니다.
 * 교회 글과 모들 글은 그곳에 속한 사람만 봅니다.
 * 익명을 고르면 이름을 보이지 않습니다.
 */

export type DiscussionScopeKind = "seogwipo" | "jeju_city" | "jeju" | "church" | "gathering" | "all";

export type DiscussionScope = {
  kind: DiscussionScopeKind;
  id: string;
};

const BROAD: ReadonlySet<DiscussionScopeKind> = new Set(["seogwipo", "jeju_city", "jeju", "all"]);

export function isBroadDiscussionScope(kind: string): kind is "seogwipo" | "jeju_city" | "jeju" | "all" {
  return BROAD.has(kind as DiscussionScopeKind);
}

/** 지역과 전체는 항상 두고, 속한 교회와 모들은 이름 자리로 나열합니다. */
export function discussionScopesFor(input: { churchIds: readonly string[]; groupIds: readonly string[] }): DiscussionScope[] {
  return [
    { kind: "seogwipo", id: "seogwipo" },
    { kind: "jeju_city", id: "jeju_city" },
    { kind: "jeju", id: "jeju" },
    ...input.churchIds.map((id) => ({ kind: "church" as const, id })),
    ...input.groupIds.map((id) => ({ kind: "gathering" as const, id })),
    { kind: "all", id: "all" },
  ];
}

export function discussionScopeFromRef(value: string, scopes: readonly DiscussionScope[]): DiscussionScope | null {
  const splitAt = value.indexOf(":");
  if (splitAt <= 0) return null;
  const kind = value.slice(0, splitAt);
  const id = value.slice(splitAt + 1);
  if (kind !== "seogwipo" && kind !== "jeju_city" && kind !== "jeju" && kind !== "church" && kind !== "gathering" && kind !== "all") {
    return null;
  }
  return scopes.find((scope) => scope.kind === kind && scope.id === id) ?? null;
}

type DiscussionPostPlace = {
  scope?: string | null;
  churchId: string | null;
  groupId: string | null;
  isJeju?: boolean;
};

export function resolvedDiscussionScope(post: DiscussionPostPlace): DiscussionScopeKind | "" {
  if (post.scope === "seogwipo" || post.scope === "jeju_city" || post.scope === "jeju" || post.scope === "church" || post.scope === "gathering" || post.scope === "all") {
    return post.scope;
  }
  if (post.isJeju) return "jeju";
  if (post.groupId) return "gathering";
  if (post.churchId) return "church";
  return "";
}

export function canSeeDiscussionPost(
  post: DiscussionPostPlace,
  viewer: { churchIds: ReadonlySet<string>; groupIds: ReadonlySet<string> },
): boolean {
  const scope = resolvedDiscussionScope(post);
  if (scope === "church") return Boolean(post.churchId && viewer.churchIds.has(post.churchId) && !post.groupId);
  if (scope === "gathering") return Boolean(post.groupId && viewer.groupIds.has(post.groupId) && !post.churchId);
  if (isBroadDiscussionScope(scope)) return post.churchId == null && post.groupId == null;
  return false;
}

/** 익명을 고르면 실명을 어디에도 돌려주지 않습니다. */
export function visibleAuthorName(input: { anonymous: boolean; name: string }): string {
  if (input.anonymous) return "익명";
  return input.name;
}
