/**
 * 한 교회의, 또는 한 모들의 인스타그램을 가져옵니다.
 * Meta 열쇠가 있으면 그래프를 읽고, 없으면 공개 웹 프로필로 최신 글을 읽습니다.
 * 둘 다 안 되면 공개 주소 임베드로 남깁니다. 열쇠는 환경 변수에만 둡니다.
 */

import {
  instagramUsername,
  proxiedInstagramImageUrl,
  readInstagramMedia,
  type InstagramPost,
} from "@/promo/instagram";
import { fetchWebProfilePosts } from "@/promo/instagram-web";
import { instagramHref } from "@/promo/rules";

function withProxiedImages(posts: InstagramPost[]): InstagramPost[] {
  return posts.map((post) => ({ ...post, imageUrl: proxiedInstagramImageUrl(post.imageUrl) }));
}

export type InstagramFeed =
  | { status: "hidden" }
  | { status: "unavailable"; reason: string }
  | { status: "embed"; href: string }
  | { status: "ready"; href: string; posts: InstagramPost[] };

type FeedEnv = { token: string; userId: string };

/** 계정이 있으면 ready(글 목록) 또는 embed 입니다. 빈 격자는 만들지 않습니다. */
export async function loadInstagramFeed(
  account: string,
  deps?: { env?: FeedEnv; fetchImpl?: typeof fetch },
): Promise<InstagramFeed> {
  const href = instagramHref(account);
  const username = instagramUsername(account);
  if (!account.trim()) return { status: "hidden" };
  if (!username || !href) return { status: "unavailable", reason: "인스타그램 계정을 읽지 못했습니다." };
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const token = deps?.env?.token ?? process.env.META_GRAPH_ACCESS_TOKEN?.trim() ?? "";
  const userId = deps?.env?.userId ?? process.env.META_INSTAGRAM_USER_ID?.trim() ?? "";

  if (token && userId && /^\d+$/.test(userId)) {
    try {
      const url = new URL(`https://graph.facebook.com/v21.0/${userId}`);
      url.searchParams.set(
        "fields",
        `business_discovery.username(${username}){media.limit(18){id,caption,media_type,media_url,permalink,thumbnail_url,timestamp}}`,
      );
      url.searchParams.set("access_token", token);
      const response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const payload: unknown = await response.json();
      if (response.ok && payload && typeof payload === "object" && !("error" in payload)) {
        const posts = withProxiedImages(readInstagramMedia(payload));
        if (posts.length > 0) return { status: "ready", href, posts };
      }
    } catch {
      /* 공개 프로필로 이어갑니다. */
    }
  }

  // Meta Graph 열쇠가 없거나 막히면, 공개 웹 프로필에서 최신 글을 읽어 폰 그리드로 보여 줍니다.
  const webPosts = withProxiedImages(await fetchWebProfilePosts(username, fetchImpl));
  if (webPosts.length > 0) return { status: "ready", href, posts: webPosts };

  return { status: "embed", href };
}
