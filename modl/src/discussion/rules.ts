/**
 * 토론 범위입니다. 기도와 같은 분류입니다.
 * 전체, 제주시, 서귀포시는 로그인한 사람이 봅니다.
 * 교회 글과 모들 글은 그곳에 속한 사람만 봅니다.
 * 제주도와 전체 교회라는 버튼은 두지 않습니다. 예전 제주도 글은 전체로 봅니다.
 * 익명을 고르면 이름을 보이지 않습니다.
 */

export type DiscussionScopeKind = "all" | "jeju_city" | "seogwipo" | "jeju" | "church" | "gathering";

export type DiscussionScope = {
  kind: DiscussionScopeKind;
  id: string;
};

const BROAD: ReadonlySet<DiscussionScopeKind> = new Set(["all", "jeju_city", "seogwipo", "jeju"]);

export function isBroadDiscussionScope(kind: string): kind is "seogwipo" | "jeju_city" | "jeju" | "all" {
  return BROAD.has(kind as DiscussionScopeKind);
}

/** 전체, 제주시, 서귀포시, 속한 교회, 속한 모들 순입니다. */
export function discussionScopesFor(input: { churchIds: readonly string[]; groupIds: readonly string[] }): DiscussionScope[] {
  return [
    { kind: "all", id: "all" },
    { kind: "jeju_city", id: "jeju_city" },
    { kind: "seogwipo", id: "seogwipo" },
    ...input.churchIds.map((id) => ({ kind: "church" as const, id })),
    ...input.groupIds.map((id) => ({ kind: "gathering" as const, id })),
  ];
}

/** 목록 필터 키입니다. 예전 제주도 글은 전체로 모읍니다. */
export function discussionScopeKey(post: { scope?: string | null; churchId: string | null; groupId: string | null; isJeju?: boolean }): string {
  const kind = resolvedDiscussionScope(post);
  if (kind === "church" && post.churchId) return `church:${post.churchId}`;
  if (kind === "gathering" && post.groupId) return `gathering:${post.groupId}`;
  if (kind === "jeju_city" || kind === "seogwipo") return kind;
  if (kind === "all" || kind === "jeju") return "all";
  return "all";
}

export function discussionScopeFromRef(value: string, scopes: readonly DiscussionScope[]): DiscussionScope | null {
  const splitAt = value.indexOf(":");
  if (splitAt <= 0) return null;
  const kind = value.slice(0, splitAt);
  const id = value.slice(splitAt + 1);
  if (kind !== "all" && kind !== "seogwipo" && kind !== "jeju_city" && kind !== "jeju" && kind !== "church" && kind !== "gathering") {
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
  if (post.scope === "all" || post.scope === "seogwipo" || post.scope === "jeju_city" || post.scope === "jeju" || post.scope === "church" || post.scope === "gathering") {
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
