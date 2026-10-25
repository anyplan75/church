/**
 * 한 교회의, 또는 한 모들의 유튜브 최신 글 3개를 가져옵니다.
 * 열쇠가 없어도 공개 목록을 먼저 읽고, 필요할 때만 환경 변수를 씁니다.
 */

import {
  channelIdFromHtml,
  readYoutubeRss,
  videoIdsFromHtml,
  youtubeTarget,
  type YoutubeVideo,
} from "@/promo/youtube";

export type YoutubeFeed =
  | { status: "hidden" }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; videos: YoutubeVideo[] };

type FeedDeps = { apiKey?: string; fetchImpl?: typeof fetch };

function clean(message: string, secret: string): string {
  const text = secret ? message.split(secret).join("") : message;
  const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 180);
  return trimmed || "유튜브 글을 읽지 못했습니다.";
}

async function readText(fetchImpl: typeof fetch, url: string): Promise<string | null> {
  const response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  return response.text();
}

async function videosFromChannel(fetchImpl: typeof fetch, channelId: string): Promise<YoutubeVideo[]> {
  const xml = await readText(fetchImpl, `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
  if (!xml) return [];
  return readYoutubeRss(xml);
}

async function channelFromPage(fetchImpl: typeof fetch, pageUrl: string): Promise<string | null> {
  const html = await readText(fetchImpl, pageUrl);
  if (!html) return null;
  return channelIdFromHtml(html);
}

/** RSS 가 비어 있을 때, 채널 페이지 HTML + oEmbed 로 최신 글 3개를 읽습니다. */
async function videosFromChannelPage(fetchImpl: typeof fetch, pageUrl: string): Promise<YoutubeVideo[]> {
  const html = await readText(fetchImpl, pageUrl);
  if (!html) return [];
  const ids = videoIdsFromHtml(html);
  if (ids.length === 0) return [];
  return videosFromSaved(
    fetchImpl,
    ids.map((id) => ({ id, title: "", url: `https://www.youtube.com/watch?v=${id}` })),
  );
}

function channelPageUrl(target: {
  kind: "channel" | "handle" | "user" | "custom";
  id?: string;
  handle?: string;
  user?: string;
  name?: string;
}): string {
  if (target.kind === "channel" && target.id) return `https://www.youtube.com/channel/${target.id}`;
  if (target.kind === "handle" && target.handle) return `https://www.youtube.com/@${encodeURIComponent(target.handle)}`;
  if (target.kind === "custom" && target.name) return `https://www.youtube.com/c/${encodeURIComponent(target.name)}`;
  if (target.kind === "user" && target.user) return `https://www.youtube.com/user/${encodeURIComponent(target.user)}`;
  return "https://www.youtube.com/";
}

async function videosFromApi(fetchImpl: typeof fetch, apiKey: string, query: string): Promise<YoutubeVideo[] | null> {
  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "contentDetails");
  channelUrl.searchParams.set("key", apiKey);
  const [name, value] = query.split("=");
  if (!name || !value) return null;
  channelUrl.searchParams.set(name, value);
  const channelResponse = await fetchImpl(channelUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  const channelPayload: unknown = await channelResponse.json();
  if (!channelPayload || typeof channelPayload !== "object") return null;
  if ("error" in channelPayload) return null;
  const items = "items" in channelPayload && Array.isArray(channelPayload.items) ? channelPayload.items : [];
  const first = items[0];
  const uploads =
    first && typeof first === "object" && "contentDetails" in first && first.contentDetails && typeof first.contentDetails === "object" && "relatedPlaylists" in first.contentDetails && first.contentDetails.relatedPlaylists && typeof first.contentDetails.relatedPlaylists === "object" && "uploads" in first.contentDetails.relatedPlaylists && typeof first.contentDetails.relatedPlaylists.uploads === "string"
      ? first.contentDetails.relatedPlaylists.uploads
      : "";
  if (!uploads) return null;
  const listUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  listUrl.searchParams.set("part", "snippet");
  listUrl.searchParams.set("maxResults", "3");
  listUrl.searchParams.set("playlistId", uploads);
  listUrl.searchParams.set("key", apiKey);
  const listResponse = await fetchImpl(listUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  const listPayload: unknown = await listResponse.json();
  if (!listPayload || typeof listPayload !== "object" || !("items" in listPayload) || !Array.isArray(listPayload.items)) return null;
  const videos: YoutubeVideo[] = [];
  for (const item of listPayload.items) {
    if (videos.length >= 3) break;
    if (!item || typeof item !== "object" || !("snippet" in item) || !item.snippet || typeof item.snippet !== "object") continue;
    const snippet = item.snippet;
    const title = "title" in snippet && typeof snippet.title === "string" ? snippet.title.trim() : "";
    const resource = "resourceId" in snippet && snippet.resourceId && typeof snippet.resourceId === "object" ? snippet.resourceId : null;
    const id = resource && "videoId" in resource && typeof resource.videoId === "string" ? resource.videoId : "";
    if (!/^[A-Za-z0-9_-]{6,}$/.test(id) || !title) continue;
    videos.push({
      id,
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }
  return videos;
}

async function videosFromSaved(
  fetchImpl: typeof fetch,
  saved: readonly { id: string; title: string; url: string }[],
): Promise<YoutubeVideo[]> {
  const videos: YoutubeVideo[] = [];
  for (const item of saved) {
    if (videos.length >= 3) break;
    let title = item.title;
    try {
      const endpoint = new URL("https://www.youtube.com/oembed");
      endpoint.searchParams.set("url", item.url);
      endpoint.searchParams.set("format", "json");
      const response = await fetchImpl(endpoint, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const payload: unknown = await response.json();
        if (payload && typeof payload === "object" && "title" in payload && typeof payload.title === "string" && payload.title.trim()) {
          title = payload.title.trim();
        }
      }
    } catch {
      title = item.title;
    }
    if (!title) continue;
    videos.push({
      id: item.id,
      title,
      url: item.url,
      thumbnailUrl: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    });
  }
  return videos;
}

/** 가져온 글이 있을 때만 ready 입니다. 부족한 개수는 채우지 않습니다. */
export async function loadYoutubeFeed(
  posts: readonly { title: string; url: string }[],
  deps?: FeedDeps,
): Promise<YoutubeFeed> {
  const target = youtubeTarget(posts);
  if (!posts.some((post) => post.url.trim() || post.title.trim())) return { status: "hidden" };
  if (!target) return { status: "unavailable", reason: "유튜브 주소를 읽지 못했습니다." };
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const apiKey = deps?.apiKey ?? process.env.YOUTUBE_API_KEY?.trim() ?? "";
  try {
    if (target.kind === "videos") {
      const videos = await videosFromSaved(fetchImpl, target.videos);
      if (videos.length === 0) return { status: "unavailable", reason: "적어 둔 유튜브 글을 읽지 못했습니다." };
      return { status: "ready", videos };
    }
    let videos: YoutubeVideo[] = [];
    if (apiKey) {
      const query =
        target.kind === "channel" ? `id=${target.id}` : target.kind === "handle" ? `forHandle=${target.handle}` : target.kind === "user" ? `forUsername=${target.user}` : `forHandle=${target.name}`;
      const fromApi = await videosFromApi(fetchImpl, apiKey, query);
      videos = fromApi ?? [];
    }
    if (videos.length === 0 && target.kind !== "videos") {
      const pageUrl = channelPageUrl(target);
      let channelId = target.kind === "channel" ? target.id : "";
      if (!channelId) channelId = (await channelFromPage(fetchImpl, pageUrl)) ?? "";
      if (!channelId && target.kind === "user") {
        const xml = await readText(fetchImpl, `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(target.user)}`);
        videos = xml ? readYoutubeRss(xml) : [];
      }
      if (videos.length === 0 && channelId) videos = await videosFromChannel(fetchImpl, channelId);
      // RSS 가 막히거나 비면 채널 페이지에서 최근 영상 번호를 읽어 채웁니다.
      if (videos.length === 0) videos = await videosFromChannelPage(fetchImpl, pageUrl);
    }
    if (videos.length === 0) {
      return {
        status: "unavailable",
        reason: apiKey ? "유튜브 최신 글을 읽지 못했습니다." : "유튜브 최신 글을 읽지 못했습니다. 공개 목록이 비어 있고 YOUTUBE_API_KEY 도 없습니다.",
      };
    }
    return { status: "ready", videos: videos.slice(0, 3) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { status: "unavailable", reason: clean(message, apiKey) };
  }
}
