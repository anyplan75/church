import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanResourceUrl,
  isPostCategory,
  membershipFromRaw,
  postsFromMap,
  regionIdFrom,
  regionLabel,
} from "./community.ts";
import { can, canOpenPath, type Role } from "./roles.ts";

describe("community helpers", () => {
  it("builds region id from sido and district", () => {
    assert.equal(regionIdFrom("제주", "서귀포시"), "제주-서귀포시");
    assert.equal(regionIdFrom("제주", ""), "제주");
    assert.equal(regionIdFrom("없는곳", "시청"), "");
    assert.equal(regionLabel("제주", "서귀포시"), "제주 서귀포시");
  });

  it("parses posts and membership", () => {
    assert.equal(isPostCategory("promo"), true);
    assert.equal(isPostCategory("other"), false);
    const posts = postsFromMap({
      "post-1": {
        title: "안내",
        body: "본문",
        category: "notice",
        authorUid: "u1",
        authorEmail: "a@b.c",
        churchId: "c1",
        createdAt: 2,
        comments: { cmt: { body: "ok" } },
      },
      "post-2": {
        title: "홍보",
        body: "행사",
        category: "promo",
        authorUid: "u2",
        authorEmail: "b@b.c",
        churchId: "c1",
        createdAt: 1,
      },
    });
    assert.equal(posts.length, 2);
    assert.equal(posts[0]?.id, "post-1");
    assert.equal(membershipFromRaw({ regionId: "제주", sido: "제주", district: "", churchId: "c1", updatedAt: 1 })?.regionId, "제주");
    assert.equal(membershipFromRaw({ regionId: "x", sido: "없는곳" }), null);
  });

  it("normalizes resource links", () => {
    assert.equal(cleanResourceUrl("https://example.com/a"), "https://example.com/a");
    assert.equal(cleanResourceUrl("example.com/a"), "https://example.com/a");
    assert.equal(cleanResourceUrl("not a url"), "");
  });
});

describe("community access", () => {
  it("lets every church role open /community", () => {
    for (const role of ["view", "prepare", "run", "output", "directory", "admin"] as Role[]) {
      assert.equal(can([role], "screen.community"), true);
      assert.equal(canOpenPath([role], "/community"), true);
    }
  });
});
