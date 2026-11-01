import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readYoutubeRss, youtubeTarget } from "@/promo/youtube";
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
});
