import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { instagramFrameSrc, instagramUsername, proxiedInstagramImageUrl, readInstagramMedia } from "@/promo/instagram";
import { readWebProfileMedia } from "@/promo/instagram-web";
import { loadInstagramFeed } from "@/server/promo/instagram-feed";

describe("인스타그램 최신 글", () => {
  it("CDN 그림 주소를 서버 경유 주소로 바꿉니다", () => {
    const src = proxiedInstagramImageUrl("https://scontent.cdninstagram.com/a.jpg");
    assert.equal(src.startsWith("/api/promo/instagram-media?u="), true);
    assert.equal(proxiedInstagramImageUrl("https://evil.test/a.jpg"), "https://evil.test/a.jpg");
  });

  it("공개 주소를 폰 틀용 embed 주소로 바꿉니다", () => {
    assert.equal(instagramFrameSrc("https://instagram.com/modl.jeju/"), "https://www.instagram.com/modl.jeju/embed/");
    assert.equal(
      instagramFrameSrc("https://www.instagram.com/p/AbCdEf12345/"),
      "https://www.instagram.com/p/AbCdEf12345/embed/captioned/",
    );
    assert.equal(instagramFrameSrc("https://example.com/x"), null);
  });

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

  it("공개 웹 프로필 JSON에서 게시물 칸을 읽습니다", () => {
    const posts = readWebProfileMedia({
      data: {
        user: {
          edge_owner_to_timeline_media: {
            edges: [
              {
                node: {
                  id: "11",
                  shortcode: "AbCdEf",
                  display_url: "https://scontent.cdninstagram.com/a.jpg",
                  edge_media_to_caption: { edges: [{ node: { text: "한라산" } }] },
                },
              },
            ],
          },
        },
      },
    });
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.permalink, "https://www.instagram.com/p/AbCdEf/");
    assert.equal(posts[0]?.caption, "한라산");
  });

  it("토큰이 없어도 공개 웹 프로필 글을 읽어 그리드로 씁니다", async () => {
    const result = await loadInstagramFeed("@modl.jeju", {
      env: { token: "", userId: "" },
      fetchImpl: async () =>
        Response.json({
          data: {
            user: {
              edge_owner_to_timeline_media: {
                edges: [
                  {
                    node: {
                      id: "1",
                      shortcode: "ZzYyXx",
                      display_url: "https://scontent.cdninstagram.com/a.jpg",
                      edge_media_to_caption: { edges: [] },
                    },
                  },
                ],
              },
            },
          },
        }),
    });
    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.equal(result.posts.length, 1);
      assert.equal(result.posts[0]?.imageUrl.startsWith("/api/promo/instagram-media?u="), true);
    }
  });

  it("공개 프로필도 비면 embed 로 남깁니다", async () => {
    const result = await loadInstagramFeed("@modl.jeju", {
      env: { token: "", userId: "" },
      fetchImpl: async () => Response.json({ data: { user: { edge_owner_to_timeline_media: { edges: [] } } } }),
    });
    assert.equal(result.status, "embed");
    if (result.status === "embed") assert.equal(result.href, "https://instagram.com/modl.jeju");
  });

  it("그래프가 막혀도 공개 프로필로 이어가고 열쇠는 남기지 않습니다", async () => {
    const token = "unit-test-token";
    let called = "";
    const result = await loadInstagramFeed("modl", {
      env: { token, userId: "123" },
      fetchImpl: async (input) => {
        called = String(input);
        if (called.includes("graph.facebook.com")) return Response.json({ error: { message: `거절 ${token}` } });
        return Response.json({
          data: {
            user: {
              edge_owner_to_timeline_media: {
                edges: [
                  {
                    node: {
                      id: "9",
                      shortcode: "Fallback1",
                      display_url: "https://scontent.cdninstagram.com/b.jpg",
                      edge_media_to_caption: { edges: [] },
                    },
                  },
                ],
              },
            },
          },
        });
      },
    });
    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.equal(result.posts[0]?.permalink.includes("Fallback1"), true);
      assert.equal(JSON.stringify(result).includes(token), false);
    }
  });
});
