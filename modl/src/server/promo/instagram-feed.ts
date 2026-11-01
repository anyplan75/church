/**
 * 한 교회의, 또는 한 모들의 인스타그램 최신 글을 가져옵니다.
 * 열쇠는 환경 변수에만 있고, 없거나 글을 못 읽으면 빈 목록을 만들지 않습니다.
 */

import { instagramUsername, readInstagramMedia, type InstagramPost } from "@/promo/instagram";

export type InstagramFeed =
  | { status: "hidden" }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; posts: InstagramPost[] };

type FeedEnv = { token: string; userId: string };

function hiddenReason(message: string, secrets: readonly string[]): string {
  let text = message;
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("");
  }
  const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 180);
  return trimmed || "인스타그램 글을 읽지 못했습니다.";
}

/** 계정 글이 있을 때만 ready 입니다. */
export async function loadInstagramFeed(
  account: string,
  deps?: { env?: FeedEnv; fetchImpl?: typeof fetch },
): Promise<InstagramFeed> {
  const username = instagramUsername(account);
  if (!account.trim()) return { status: "hidden" };
  if (!username) return { status: "unavailable", reason: "인스타그램 계정을 읽지 못했습니다." };
  const token = deps?.env?.token ?? process.env.META_GRAPH_ACCESS_TOKEN?.trim() ?? "";
  const userId = deps?.env?.userId ?? process.env.META_INSTAGRAM_USER_ID?.trim() ?? "";
  if (!token || !userId) {
    return {
      status: "unavailable",
      reason: "Meta 그래프 토큰(META_GRAPH_ACCESS_TOKEN)이나 인스타그램 사용자 번호(META_INSTAGRAM_USER_ID)가 환경 변수에 없습니다.",
    };
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
    if (!payload || typeof payload !== "object") return { status: "unavailable", reason: "인스타그램 응답을 읽지 못했습니다." };
    if ("error" in payload && payload.error && typeof payload.error === "object" && "message" in payload.error && typeof payload.error.message === "string") {
      return { status: "unavailable", reason: hiddenReason(payload.error.message, [token, userId]) };
    }
    if (!response.ok) return { status: "unavailable", reason: "인스타그램 글을 가져오지 못했습니다." };
    const posts = readInstagramMedia(payload);
    if (posts.length === 0) return { status: "unavailable", reason: "계정은 있으나 가져올 인스타그램 글이 없습니다." };
    return { status: "ready", posts };
  } catch {
    return { status: "unavailable", reason: "인스타그램에 연결하지 못했습니다." };
  }
}
