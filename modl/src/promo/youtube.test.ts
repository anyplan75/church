import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyYoutubeUrl, readYoutubeRss, videoIdsFromHtml, youtubeTarget } from "@/promo/youtube";
import { loadYoutubeFeed } from "@/server/promo/youtube-feed";

const rss = `<?xml version="1.0"?>
<feed>
  <entry><yt:videoId>aaaaaaaaaaa</yt:videoId><title>하나</title></entry>
  <entry><yt:videoId>bbbbbbbbbbb</yt:videoId><title>둘</title></entry>
</feed>`;

describe("유튜브 최신 글", () => {
  it("공개 목록은 3개를 넘기지 않고 있는 것만 남깁니다", () => {
    const two = readYoutubeRss(rss);
    assert.equal(two.length, 2);
    assert.equal(two[0]?.title, "하나");
    const many = readYoutubeRss(
      "<feed>" +
        ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"]
          .map((id, index) => `<entry><yt:videoId>${id}</yt:videoId><title>글${index}</title></entry>`)
          .join("") +
        "</feed>",
    );
    assert.equal(many.length, 3);
    assert.equal(many[2]?.title, "글2");
  });

  it("영상만 적혀 있으면 마지막에 적은 3개만 고릅니다", () => {
    const target = youtubeTarget([
      { title: "가", url: "https://youtu.be/aaaaaaaaaaa" },
      { title: "나", url: "https://youtu.be/bbbbbbbbbbb" },
      { title: "다", url: "https://www.youtube.com/watch?v=ccccccccccc" },
      { title: "라", url: "https://www.youtube.com/shorts/ddddddddddd" },
    ]);
    assert.equal(target?.kind, "videos");
    if (target?.kind === "videos") assert.deepEqual(target.videos.map((video) => video.title), ["나", "다", "라"]);
  });

  it("한글 핸들 채널 주소를 읽습니다", () => {
    const found = classifyYoutubeUrl("https://www.youtube.com/@서귀포제일교회");
    assert.equal(found?.kind, "handle");
    if (found?.kind === "handle") assert.equal(found.handle, "서귀포제일교회");
  });

  it("채널 HTML 에서 영상 번호를 순서대로 3개까지 읽습니다", () => {
    const ids = videoIdsFromHtml('"videoId":"aaaaaaaaaaa" "videoId":"aaaaaaaaaaa" "videoId":"bbbbbbbbbbb" "videoId":"ccccccccccc" "videoId":"ddddddddddd"');
    assert.deepEqual(ids, ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]);
  });

  it("채널 주소가 있으면 그 채널의 최신 글을 가져오고 빈 칸은 만들지 않습니다", async () => {
    const channel = youtubeTarget([{ title: "채널", url: "https://www.youtube.com/channel/UCccccccccccc" }]);
    assert.equal(channel?.kind, "channel");
    let called = "";
    const result = await loadYoutubeFeed([{ title: "채널", url: "https://www.youtube.com/@modljeju" }], {
      apiKey: "",
      fetchImpl: async (input) => {
        called = String(input);
        if (called.includes("youtube.com/@modljeju")) {
          return new Response(`<html>"externalId":"UCccccccccccc"</html>`);
        }
        return new Response(rss);
      },
    });
    assert.equal(result.status, "ready");
    if (result.status === "ready") assert.equal(result.videos.length, 2);
    assert.equal(called.includes("feeds/videos.xml"), true);
    const hidden = await loadYoutubeFeed([], { fetchImpl: async () => new Response("") });
    assert.equal(hidden.status, "hidden");
  });

  it("RSS 가 비면 채널 페이지 HTML 로 최신 글 3개를 채웁니다", async () => {
    const result = await loadYoutubeFeed([{ title: "채널", url: "https://www.youtube.com/channel/UCccccccccccc" }], {
      apiKey: "",
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("feeds/videos.xml")) return new Response("not found", { status: 404 });
        if (url.includes("oembed")) {
          const id = new URL(url).searchParams.get("url")?.split("v=")[1] ?? "";
          return Response.json({ title: `제목-${id}` });
        }
        return new Response(`<html>"videoId":"aaaaaaaaaaa""videoId":"bbbbbbbbbbb""videoId":"ccccccccccc"</html>`);
      },
    });
    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.equal(result.videos.length, 3);
      assert.equal(result.videos[0]?.title, "제목-aaaaaaaaaaa");
    }
  });
});
