/**
 * 한 교회의, 또는 한 모들의 인스타그램을 가져옵니다.
 * Meta 열쇠가 있으면 최신 글을 읽고, 없으면 공개 주소로 페이지 안 임베드를 씁니다.
 * 열쇠는 환경 변수에만 두고 코드에 적지 않습니다.
 */

import { instagramUsername, readInstagramMedia, type InstagramPost } from "@/promo/instagram";
import { instagramHref } from "@/promo/rules";

export type InstagramFeed =
  | { status: "hidden" }
  | { status: "unavailable"; reason: string }
  | { status: "embed"; href: string }
  | { status: "ready"; href: string; posts: InstagramPost[] };

type FeedEnv = { token: string; userId: string };

/** 계정이 있으면 embed 또는 ready 입니다. 빈 격자는 만들지 않습니다. */
export async function loadInstagramFeed(
  account: string,
  deps?: { env?: FeedEnv; fetchImpl?: typeof fetch },
): Promise<InstagramFeed> {
  const href = instagramHref(account);
  const username = instagramUsername(account);
  if (!account.trim()) return { status: "hidden" };
  if (!username || !href) return { status: "unavailable", reason: "인스타그램 계정을 읽지 못했습니다." };
  const token = deps?.env?.token ?? process.env.META_GRAPH_ACCESS_TOKEN?.trim() ?? "";
  const userId = deps?.env?.userId ?? process.env.META_INSTAGRAM_USER_ID?.trim() ?? "";
  if (!token || !userId) {
    // Meta Graph 열쇠가 없어도 공개 프로필 주소로 페이지 안 임베드를 씁니다.
    return { status: "embed", href };
  }
  if (!/^\d+$/.test(userId)) return { status: "unavailable", reason: "인스타그램 사용자 번호가 올바르지 않습니다." };
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const url = new URL(`https://graph.facebook.com/v21.0/${userId}`);
  url.searchParams.set(
    "fields",
    `business_discovery.username(${username}){media.limit(12){id,caption,media_type,media_url,permalink,thumbnail_url,timestamp}}`,
  );
  url.searchParams.set("access_token", token);
  try {
    const response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return { status: "embed", href };
    if ("error" in payload && payload.error && typeof payload.error === "object" && "message" in payload.error && typeof payload.error.message === "string") {
      // 그래프가 막혀도 공개 임베드로 페이지 안에 보여 줍니다.
      return { status: "embed", href };
    }
    if (!response.ok) return { status: "embed", href };
    const posts = readInstagramMedia(payload);
    if (posts.length === 0) return { status: "embed", href };
    return { status: "ready", href, posts };
  } catch {
    return { status: "embed", href };
  }
}
