/**
 * 홍보 페이지에 적은 유튜브에서 최신 글 3개를 고릅니다.
 * 3개보다 적으면 있는 것만 남기고, 빈 칸은 만들지 않습니다.
 */

export type YoutubeVideo = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
};

const VIDEO_ID = /^[A-Za-z0-9_-]{6,}$/;

export type YoutubeTarget =
  | { kind: "channel"; id: string }
  | { kind: "handle"; handle: string }
  | { kind: "user"; user: string }
  | { kind: "custom"; name: string }
  | { kind: "videos"; videos: { id: string; title: string; url: string }[] };

function videoOf(id: string): { id: string } | null {
  return VIDEO_ID.test(id) ? { id } : null;
}

/** 주소 하나에서 채널이나 영상 번호를 읽습니다. */
export function classifyYoutubeUrl(raw: string): Exclude<YoutubeTarget, { kind: "videos" }> | { kind: "video"; id: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter((part) => part.length > 0)[0] ?? "";
    return videoOf(id) ? { kind: "video", id } : null;
  }
  if (host !== "youtube.com") return null;
  const parts = url.pathname.split("/").filter((part) => part.length > 0);
  const head = parts[0] ?? "";
  if (head.startsWith("@")) {
    const handle = head.slice(1);
    return /^[A-Za-z0-9._-]{1,80}$/.test(handle) ? { kind: "handle", handle } : null;
  }
  if (head === "channel" && parts[1]?.startsWith("UC") && VIDEO_ID.test(parts[1])) return { kind: "channel", id: parts[1] };
  if (head === "user" && parts[1] && /^[A-Za-z0-9._-]{1,80}$/.test(parts[1])) return { kind: "user", user: parts[1] };
  if (head === "c" && parts[1] && /^[A-Za-z0-9._-]{1,80}$/.test(parts[1])) return { kind: "custom", name: parts[1] };
  if (head === "watch") {
    const id = url.searchParams.get("v") ?? "";
    return videoOf(id) ? { kind: "video", id } : null;
  }
  if ((head === "shorts" || head === "embed" || head === "live") && parts[1] && videoOf(parts[1])) return { kind: "video", id: parts[1] };
  return null;
}

/** 적어 둔 주소 가운데 채널이 있으면 채널을, 없으면 마지막에 적은 영상부터 3개까지 고릅니다. */
export function youtubeTarget(posts: readonly { title: string; url: string }[]): YoutubeTarget | null {
  const videos: { id: string; title: string; url: string }[] = [];
  for (const post of posts) {
    const found = classifyYoutubeUrl(post.url);
    if (!found) continue;
    if (found.kind !== "video") return found;
    videos.push({ id: found.id, title: post.title.trim(), url: `https://www.youtube.com/watch?v=${found.id}` });
  }
  if (videos.length === 0) return null;
  return { kind: "videos", videos: videos.slice(-3) };
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

/** 유튜브 공개 목록에서 최신 글만 읽습니다. 3개를 넘기지 않습니다. */
export function readYoutubeRss(xml: string): YoutubeVideo[] {
  const videos: YoutubeVideo[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    if (videos.length >= 3) break;
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim() ?? "";
    const title = decodeXml(entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").trim();
    if (!VIDEO_ID.test(id) || !title) continue;
    videos.push({
      id,
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }
  return videos;
}

/** 채널 페이지 글에서 채널 번호만 뽑습니다. */
export function channelIdFromHtml(html: string): string | null {
  const match =
    html.match(/"externalId":"(UC[A-Za-z0-9_-]{6,})"/) ??
    html.match(/"channelId":"(UC[A-Za-z0-9_-]{6,})"/) ??
    html.match(/channel_id=(UC[A-Za-z0-9_-]{6,})/);
  const id = match?.[1] ?? "";
  return VIDEO_ID.test(id) ? id : null;
}
