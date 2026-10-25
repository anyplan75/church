/**
 * 인스타그램 계정에서 최신 글을 고릅니다.
 * 여기에는 비밀 열쇠를 두지 않습니다.
 */

import { instagramHref } from "@/promo/rules";

export type InstagramPost = {
  id: string;
  permalink: string;
  imageUrl: string;
  caption: string;
};

/** 브라우저에서 CDN 이 막힐 수 있어, 같은 서버 그림 주소로 바꿉니다. */
export function proxiedInstagramImageUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:") return imageUrl;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const ok =
      host === "instagram.com" ||
      host.endsWith(".cdninstagram.com") ||
      host === "cdninstagram.com" ||
      host.endsWith(".fbcdn.net");
    if (!ok) return imageUrl;
    return `/api/promo/instagram-media?u=${encodeURIComponent(url.toString())}`;
  } catch {
    return imageUrl;
  }
}

/** 공개 주소를 폰 틀 안 iframe(/embed) 주소로 바꿉니다. */
export function instagramFrameSrc(href: string): string | null {
  try {
    const url = new URL(href.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "instagram.com") return null;
    const parts = url.pathname.split("/").filter((part) => part.length > 0);
    if (parts.length === 0) return null;
    if (parts[0] === "embed" || parts.includes("embed")) {
      return `https://www.instagram.com${url.pathname}${url.search}`;
    }
    if ((parts[0] === "p" || parts[0] === "reel" || parts[0] === "tv") && parts[1]) {
      // captioned 는 프로필 보기 글자가 커서, 짧은 embed 를 씁니다.
      return `https://www.instagram.com/${parts[0]}/${parts[1]}/embed/`;
    }
    const username = parts[0] ?? "";
    if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) return null;
    return `https://www.instagram.com/${username}/embed/`;
  } catch {
    return null;
  }
}

/** 홍보 페이지에 적은 계정에서 사용자 이름만 뽑습니다. */
export function instagramUsername(account: string): string | null {
  const href = instagramHref(account);
  if (!href) return null;
  try {
    const handle = new URL(href).pathname.split("/").filter((part) => part.length > 0)[0] ?? "";
    return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
  } catch {
    return null;
  }
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function imageHost(value: string): boolean {
  const host = new URL(value).hostname.replace(/^www\./, "");
  return host === "instagram.com" || host.endsWith(".cdninstagram.com") || host === "cdninstagram.com" || host.endsWith(".fbcdn.net");
}

/** 그래프 응답에서 그림이 있는 글만 남깁니다. 없는 글은 만들지 않습니다. */
export function readInstagramMedia(payload: unknown): InstagramPost[] {
  if (!payload || typeof payload !== "object" || !("business_discovery" in payload)) return [];
  const discovery = payload.business_discovery;
  if (!discovery || typeof discovery !== "object" || !("media" in discovery)) return [];
  const media = discovery.media;
  if (!media || typeof media !== "object" || !("data" in media) || !Array.isArray(media.data)) return [];
  const posts: InstagramPost[] = [];
  for (const row of media.data) {
    if (posts.length >= 18) break;
    if (!row || typeof row !== "object") continue;
    const id = "id" in row && typeof row.id === "string" ? row.id : "";
    const permalink = httpsUrl("permalink" in row ? row.permalink : "");
    const mediaType = "media_type" in row && typeof row.media_type === "string" ? row.media_type : "";
    const imageUrl = httpsUrl(mediaType === "VIDEO" ? ("thumbnail_url" in row ? row.thumbnail_url : "") : "media_url" in row ? row.media_url : "");
    const caption = "caption" in row && typeof row.caption === "string" ? row.caption.trim().slice(0, 80) : "";
    if (!id || !permalink || !imageUrl) continue;
    if (!imageHost(imageUrl)) continue;
    const linkHost = new URL(permalink).hostname.replace(/^www\./, "");
    if (linkHost !== "instagram.com") continue;
    posts.push({ id, permalink, imageUrl, caption });
  }
  return posts;
}
