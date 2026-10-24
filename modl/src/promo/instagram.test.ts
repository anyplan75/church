import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { instagramUsername, readInstagramMedia } from "@/promo/instagram";
import { loadInstagramFeed } from "@/server/promo/instagram-feed";

describe("인스타그램 최신 글", () => {
  it("계정에서 사용자 이름만 읽습니다", () => {
    assert.equal(instagramUsername("@modl.jeju"), "modl.jeju");
    assert.equal(instagramUsername("https://instagram.com/modl.jeju/"), "modl.jeju");
    assert.equal(instagramUsername(""), null);
    assert.equal(instagramUsername("공백 있음"), null);
  });

  it("그림이 있는 글만 남기고 없는 글은 만들지 않습니다", () => {
    const posts = readInstagramMedia({
      business_discovery: {
        media: {
          data: [
            {
              id: "1",
              media_type: "IMAGE",
              media_url: "https://scontent.cdninstagram.com/a.jpg",
              permalink: "https://www.instagram.com/p/abc/",
              caption: "예배",
            },
            { id: "2", media_type: "IMAGE", media_url: "http://evil.test/a.jpg", permalink: "https://www.instagram.com/p/bad/" },
            { id: "3", caption: "그림 없음" },
          ],
        },
      },
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.caption, "예배");
    assert.equal(readInstagramMedia({}).length, 0);
  });

  it("토큰이 없어도 공개 주소로 페이지 안 임베드를 씁니다", async () => {
    let called = 0;
    const missing = await loadInstagramFeed("@modl.jeju", {
      env: { token: "", userId: "" },
      fetchImpl: async () => {
        called += 1;
        return new Response("{}");
      },
    });
    assert.equal(missing.status, "embed");
    assert.equal(called, 0);
    if (missing.status === "embed") assert.equal(missing.href, "https://instagram.com/modl.jeju");
    const hidden = await loadInstagramFeed("  ", { env: { token: "unit-test-token", userId: "1" } });
    assert.equal(hidden.status, "hidden");
  });

  it("그래프가 막혀도 공개 임베드로 남기고 열쇠는 이유에 넣지 않습니다", async () => {
    const token = "unit-test-token";
    const result = await loadInstagramFeed("modl", {
      env: { token, userId: "123" },
      fetchImpl: async () => Response.json({ error: { message: `거절 ${token}` } }),
    });
    assert.equal(result.status, "embed");
    if (result.status === "embed") {
      assert.equal(result.href.includes("modl"), true);
      assert.equal(result.href.includes(token), false);
    }
  });
});
