/**
 * 인스타그램·유튜브 최신 글을 몇 분 동안 다시 쓰지 않고 기억합니다.
 * 바깥 사이트를 매번 기다리지 않게 해서, 같은 교회 페이지를 다시 열 때 빨라집니다.
 */

import { unstable_cache } from "next/cache";
import { loadInstagramFeed, type InstagramFeed } from "@/server/promo/instagram-feed";
import { loadYoutubeFeed, type YoutubeFeed } from "@/server/promo/youtube-feed";

/** 바깥 SNS 글을 다시 읽는 간격(초). 5분입니다. */
export const SNS_FEED_REVALIDATE_SECONDS = 5 * 60;

export async function cachedInstagramFeed(account: string): Promise<InstagramFeed> {
  const key = account.trim().toLowerCase();
  if (!key) return loadInstagramFeed(account);
  return unstable_cache(async () => loadInstagramFeed(account), ["promo-instagram-feed", key], {
    revalidate: SNS_FEED_REVALIDATE_SECONDS,
  })();
}

export async function cachedYoutubeFeed(posts: readonly { title: string; url: string }[]): Promise<YoutubeFeed> {
  const key = posts
    .map((post) => `${post.title.trim()}\0${post.url.trim()}`)
    .join("|")
    .toLowerCase()
    .slice(0, 240);
  if (!key.trim()) return loadYoutubeFeed(posts);
  return unstable_cache(async () => loadYoutubeFeed(posts), ["promo-youtube-feed", key], {
    revalidate: SNS_FEED_REVALIDATE_SECONDS,
  })();
}
