import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canUseCommunity } from "./community-access.ts";
import {
  cleanResourceUrl,
  groupAlbumFromMap,
  groupFromRaw,
  groupPostsFromMap,
  groupRoomHref,
  groupScheduleFromMap,
  groupsFromMap,
  isBoardCategory,
  isGroupRoomTab,
  isPostCategory,
  membersFromMap,
  membershipFromRaw,
  normalizeBoardCategory,
  postBookmarkKey,
  postsFromMap,
  profileFromRaw,
  regionIdFrom,
  regionLabel,
  sortGroups,
  sortPosts,
} from "./community.ts";
import { can, canOpenPath, type Role } from "./roles.ts";

describe("community helpers", () => {
  it("builds region id from sido and district", () => {
    assert.equal(regionIdFrom("제주", "서귀포시"), "제주-서귀포시");
    assert.equal(regionIdFrom("제주", ""), "제주");
    assert.equal(regionIdFrom("없는곳", "시청"), "");
    assert.equal(regionLabel("제주", "서귀포시"), "제주 서귀포시");
  });

  it("parses posts with board categories and legacy aliases", () => {
    assert.equal(isBoardCategory("free"), true);
    assert.equal(isPostCategory("promo"), true);
    assert.equal(isPostCategory("other"), false);
    assert.equal(normalizeBoardCategory("question"), "qna");
    assert.equal(normalizeBoardCategory("share"), "free");
    const posts = postsFromMap({
      "post-1": {
        title: "안내",
        body: "본문",
        category: "notice",
        authorUid: "u1",
        authorEmail: "a@b.c",
        authorNick: "안내자",
        churchId: "c1",
        churchName: "은혜교회",
        likes: 3,
        views: 10,
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
      "post-3": {
        title: "질문",
        body: "?",
        category: "question",
        authorUid: "u3",
        authorEmail: "c@b.c",
        churchId: "c1",
        createdAt: 3,
      },
    });
    assert.equal(posts.length, 3);
    assert.equal(posts[0]?.id, "post-3");
    assert.equal(posts.find((p) => p.id === "post-1")?.commentCount, 1);
    assert.equal(posts.find((p) => p.id === "post-3")?.category, "qna");
    const popular = sortPosts(posts, "popular");
    assert.equal(popular[0]?.id, "post-1");
    assert.equal(membershipFromRaw({ regionId: "제주", sido: "제주", district: "", churchId: "c1", updatedAt: 1 })?.regionId, "제주");
    assert.equal(membershipFromRaw({ regionId: "x", sido: "없는곳" }), null);
  });

  it("parses groups and sorts by popularity", () => {
    const groups = groupsFromMap({
      "grp-1": {
        title: "QT",
        category: "qt",
        place: "온라인",
        schedule: "매일",
        capacity: 10,
        memberCount: 2,
        authorUid: "u1",
        churchId: "c1",
        createdAt: 1,
      },
      "grp-2": {
        title: "취미",
        category: "hobby",
        place: "체육관",
        schedule: "토",
        description: "함께 운동해요",
        capacity: 10,
        members: { a: true, b: true, c: true },
        authorUid: "u2",
        churchId: "c1",
        createdAt: 2,
      },
    });
    assert.equal(groups.length, 2);
    assert.equal(groups.find((g) => g.id === "grp-2")?.memberCount, 3);
    assert.equal(groups.find((g) => g.id === "grp-2")?.description, "함께 운동해요");
    assert.equal(sortGroups(groups, "popular")[0]?.id, "grp-2");
    assert.equal(groupFromRaw(groups.find((g) => g.id === "grp-1"), "grp-1")?.title, "QT");
  });

  it("parses group room members, posts, schedule, album", () => {
    const members = membersFromMap(
      {
        owner: { nickname: "모임장", churchId: "c1", churchName: "은혜", joinedAt: 1, isOwner: true },
        guest: true,
        later: { nickname: "조집사", churchId: "c1", joinedAt: 3 },
      },
      "owner",
    );
    assert.equal(members[0]?.uid, "owner");
    assert.equal(members[0]?.isOwner, true);
    assert.equal(members.find((m) => m.uid === "guest")?.nickname, "멤버");
    assert.equal(members.find((m) => m.uid === "later")?.nickname, "조집사");

    const posts = groupPostsFromMap({
      "gpost-1": { title: "인사", body: "안녕하세요", authorUid: "u1", authorNick: "A", churchId: "c1", createdAt: 2 },
      "gpost-2": { title: "공지", body: "이번 주", authorUid: "u2", authorNick: "B", churchId: "c1", createdAt: 1 },
    });
    assert.equal(posts[0]?.id, "gpost-1");

    const schedule = groupScheduleFromMap({
      "gsch-1": { title: "첫 모임", when: "토 10시", place: "카페", authorUid: "u1", authorNick: "A", createdAt: 1 },
    });
    assert.equal(schedule[0]?.title, "첫 모임");

    const album = groupAlbumFromMap({
      "galb-1": { title: "사진", url: "https://example.com/a.jpg", note: "", authorUid: "u1", authorNick: "A", createdAt: 1 },
    });
    assert.equal(album[0]?.url, "https://example.com/a.jpg");
    assert.equal(groupRoomHref("grp-1", "제주"), "/community/groups/?id=grp-1&region=%EC%A0%9C%EC%A3%BC");
    assert.equal(isGroupRoomTab("board"), true);
    assert.equal(isGroupRoomTab("other"), false);
  });

  it("parses profile and bookmark keys", () => {
    const profile = profileFromRaw(
      { nickname: "조집사", churchId: "c1", churchName: "서귀포제일교회", verificationStatus: "pending", updatedAt: 1 },
      "uid1",
    );
    assert.equal(profile?.nickname, "조집사");
    assert.equal(profile?.verificationStatus, "pending");
    assert.equal(postBookmarkKey("제주", "post-1"), "제주__post-1");
  });

  it("normalizes resource links", () => {
    assert.equal(cleanResourceUrl("https://example.com/a"), "https://example.com/a");
    assert.equal(cleanResourceUrl("example.com/a"), "https://example.com/a");
    assert.equal(cleanResourceUrl("not a url"), "");
  });
});

describe("community access", () => {
  it("lets every church role open /community and group rooms", () => {
    for (const role of ["view", "prepare", "run", "output", "directory", "admin"] as Role[]) {
      assert.equal(can([role], "screen.community"), true);
      assert.equal(canOpenPath([role], "/community"), true);
      assert.equal(canOpenPath([role], "/community/"), true);
      assert.equal(canOpenPath([role], "/community/groups"), true);
      assert.equal(canOpenPath([role], "/community/groups/?id=grp-1&region=제주"), true);
    }
  });

  it("lets church staff and platform-with-church use community", () => {
    assert.equal(canUseCommunity({ kind: "church", churchId: "c11m8kdmenw" }), true);
    assert.equal(canUseCommunity({ kind: "platform", churchId: "ce21dxgt7nc" }), true);
    assert.equal(canUseCommunity({ kind: "platform", churchId: null }), false);
    assert.equal(canUseCommunity({ kind: "church", churchId: null }), false);
    assert.equal(canUseCommunity(null), false);
  });
});
