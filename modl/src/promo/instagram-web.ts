/**
 * Meta Graph 열쇠 없이, 인스타그램 공개 웹 프로필에서 최신 글을 읽습니다.
 * (인스타그램 웹사이트가 쓰는 공개 조회 경로입니다. 개인 비밀 열쇠가 아닙니다.)
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { InstagramPost } from "@/promo/instagram";

const execFileAsync = promisify(execFile);

/** 인스타그램 웹 클라이언트가 쓰는 공개 앱 번호입니다. 비밀 토큰이 아닙니다. */
const IG_WEB_APP_ID = "936619743392459";
const IG_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const MAX_POSTS = 24;

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

function mergePosts(base: InstagramPost[], extra: InstagramPost[]): InstagramPost[] {
  const seen = new Set(base.map((post) => post.id));
  const out = [...base];
  for (const post of extra) {
    if (out.length >= MAX_POSTS) break;
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    out.push(post);
  }
  return out;
}

/** 공개 프로필 JSON에서 그림이 있는 글만 남깁니다. */
export function readWebProfileMedia(payload: unknown): InstagramPost[] {
  if (!payload || typeof payload !== "object") return [];
  const data = "data" in payload && payload.data && typeof payload.data === "object" ? payload.data : null;
  const user = data && "user" in data && data.user && typeof data.user === "object" ? data.user : null;
  const timeline =
    user && "edge_owner_to_timeline_media" in user && user.edge_owner_to_timeline_media && typeof user.edge_owner_to_timeline_media === "object"
      ? user.edge_owner_to_timeline_media
      : null;
  const edges = timeline && "edges" in timeline && Array.isArray(timeline.edges) ? timeline.edges : [];
  const posts: InstagramPost[] = [];
  for (const edge of edges) {
    if (posts.length >= MAX_POSTS) break;
    if (!edge || typeof edge !== "object" || !("node" in edge) || !edge.node || typeof edge.node !== "object") continue;
    const node = edge.node;
    const shortcode = "shortcode" in node && typeof node.shortcode === "string" ? node.shortcode : "";
    const id = "id" in node && typeof node.id === "string" ? node.id : shortcode;
    const imageUrl =
      httpsUrl("display_url" in node ? node.display_url : "") ??
      httpsUrl("thumbnail_src" in node ? node.thumbnail_src : "");
    const captionNode =
      "edge_media_to_caption" in node && node.edge_media_to_caption && typeof node.edge_media_to_caption === "object" && "edges" in node.edge_media_to_caption && Array.isArray(node.edge_media_to_caption.edges)
        ? node.edge_media_to_caption.edges[0]
        : null;
    const captionText =
      captionNode && typeof captionNode === "object" && "node" in captionNode && captionNode.node && typeof captionNode.node === "object" && "text" in captionNode.node && typeof captionNode.node.text === "string"
        ? captionNode.node.text.trim().slice(0, 80)
        : "";
    if (!id || !shortcode || !imageUrl || !imageHost(imageUrl)) continue;
    posts.push({
      id,
      permalink: `https://www.instagram.com/p/${shortcode}/`,
      imageUrl,
      caption: captionText,
    });
  }
  return posts;
}

/** 공개 프로필 JSON에서 숫자 사용자 번호를 읽습니다. */
export function readWebProfileUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = "data" in payload && payload.data && typeof payload.data === "object" ? payload.data : null;
  const user = data && "user" in data && data.user && typeof data.user === "object" ? data.user : null;
  const id = user && "id" in user && typeof user.id === "string" ? user.id : "";
  return /^\d+$/.test(id) ? id : null;
}

/** 공개 사용자 피드 JSON에서 그림이 있는 글만 남깁니다. */
export function readUserFeedMedia(payload: unknown): InstagramPost[] {
  if (!payload || typeof payload !== "object") return [];
  const items = "items" in payload && Array.isArray(payload.items) ? payload.items : [];
  const posts: InstagramPost[] = [];
  for (const item of items) {
    if (posts.length >= MAX_POSTS) break;
    if (!item || typeof item !== "object") continue;
    const shortcode = "code" in item && typeof item.code === "string" ? item.code : "";
    const id =
      ("pk" in item && (typeof item.pk === "string" || typeof item.pk === "number") ? String(item.pk) : "") ||
      ("id" in item && typeof item.id === "string" ? item.id.split("_")[0] ?? "" : "") ||
      shortcode;
    let imageUrl = httpsUrl("display_uri" in item ? item.display_uri : "");
    if (!imageUrl && "image_versions2" in item && item.image_versions2 && typeof item.image_versions2 === "object") {
      const versions = item.image_versions2;
      const candidates = "candidates" in versions && Array.isArray(versions.candidates) ? versions.candidates : [];
      const first = candidates[0];
      imageUrl = first && typeof first === "object" ? httpsUrl("url" in first ? first.url : "") : null;
    }
    const captionObj = "caption" in item && item.caption && typeof item.caption === "object" ? item.caption : null;
    const captionText =
      captionObj && "text" in captionObj && typeof captionObj.text === "string" ? captionObj.text.trim().slice(0, 80) : "";
    if (!id || !shortcode || !imageUrl || !imageHost(imageUrl)) continue;
    posts.push({
      id,
      permalink: `https://www.instagram.com/p/${shortcode}/`,
      imageUrl,
      caption: captionText,
    });
  }
  return posts;
}

async function getJson(url: string, username: string, fetchImpl: typeof fetch): Promise<unknown | null> {
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
        "User-Agent": IG_UA,
        "X-IG-App-ID": IG_WEB_APP_ID,
        Referer: `https://www.instagram.com/${username}/`,
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function getJsonWithCurl(url: string, username: string): Promise<unknown | null> {
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-sL",
        "--max-time",
        "8",
        "-A",
        IG_UA,
        "-H",
        `X-IG-App-ID: ${IG_WEB_APP_ID}`,
        "-H",
        "Accept: application/json",
        "-H",
        `Referer: https://www.instagram.com/${username}/`,
        url,
      ],
      { maxBuffer: 4_000_000 },
    );
    if (!stdout.trim()) return null;
    return JSON.parse(stdout) as unknown;
  } catch {
    return null;
  }
}

async function loadJson(
  url: string,
  username: string,
  fetchImpl: typeof fetch,
  allowCurl: boolean,
): Promise<unknown | null> {
  const viaFetch = await getJson(url, username, fetchImpl);
  if (viaFetch !== null) return viaFetch;
  if (!allowCurl) return null;
  return getJsonWithCurl(url, username);
}

/** 공개 프로필·피드에서 최신 글을 가져옵니다. 실패하면 빈 목록입니다. */
export async function fetchWebProfilePosts(
  username: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InstagramPost[]> {
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) return [];
  const allowCurl = fetchImpl === fetch;
  const profileUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const payload = await loadJson(profileUrl, username, fetchImpl, allowCurl);
  let posts = readWebProfileMedia(payload);
  const userId = readWebProfileUserId(payload);
  if (userId && posts.length < MAX_POSTS) {
    const feedUrl = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=${MAX_POSTS}`;
    const feed = await loadJson(feedUrl, username, fetchImpl, allowCurl);
    posts = mergePosts(posts, readUserFeedMedia(feed));
  }
  // 프로필 fetch 자체가 막혔을 때만 curl 경로가 이미 시도됩니다. 여기선 결과만 돌립니다.
  return posts.slice(0, MAX_POSTS);
}
