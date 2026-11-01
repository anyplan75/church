import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Actor, MemberRole } from "@/server/auth/actor";
import {
  blocksForPublic,
  canEditWebsite,
  emptyBlock,
  inquiryPushReady,
  parseInquiry,
  pickLatestPublicBulletin,
  robotsForSeo,
  upcomingPublicEvents,
} from "@/website/rules";

function user(role: MemberRole): Actor {
  return {
    kind: "user",
    userId: "user-1",
    memberships: [
      {
        communityId: "community-a",
        memberId: "member-1",
        role,
        currentGroupId: null,
        leaderGroupIds: role === "CELL_LEADER" ? ["group-1"] : [],
      },
    ],
    pendingCommunityIds: [],
  };
}

const guest: Actor = { kind: "guest" };

describe("손님은 편집 불가", () => {
  it("사역자와 임원만 홈페이지를 고치고 손님과 구성원은 고치지 못합니다", () => {
    assert.equal(canEditWebsite(user("PASTOR"), "community-a"), true);
    assert.equal(canEditWebsite(user("EXECUTIVE"), "community-a"), true);
    assert.equal(canEditWebsite(user("MEMBER"), "community-a"), false);
    assert.equal(canEditWebsite(user("CELL_LEADER"), "community-a"), false);
    assert.equal(canEditWebsite(guest, "community-a"), false);
    assert.equal(canEditWebsite(user("PASTOR"), "community-b"), false);
  });
});

describe("등급별 연동 블록", () => {
  const blocks = [
    emptyBlock("intro_body", "body"),
    emptyBlock("link_bulletin", "bulletin"),
    emptyBlock("link_calendar", "calendar"),
    emptyBlock("link_survey", "survey"),
  ];

  it("무료 등급은 연동 블록을 공개 페이지에서 뺍니다", () => {
    const visible = blocksForPublic(blocks, "FREE");
    assert.deepEqual(
      visible.map((block) => block.type),
      ["intro_body"],
    );
  });

  it("유료 등급은 최신 공개 주보 블록을 남깁니다", () => {
    const visible = blocksForPublic(blocks, "PRO");
    assert.equal(visible.some((block) => block.type === "link_bulletin"), true);
    const picked = pickLatestPublicBulletin([
      { id: "new-private", worshipDate: "2026-10-25", sermonTitle: "비공개", isPublic: false, shareToken: null },
      { id: "public-old", worshipDate: "2026-10-18", sermonTitle: "은혜의 주", isPublic: true, shareToken: "token-1" },
      { id: "public-new", worshipDate: "2026-10-11", sermonTitle: "지난 말씀", isPublic: true, shareToken: "token-2" },
    ]);
    assert.equal(picked?.sermonTitle, "은혜의 주");
    assert.equal(picked?.id, "public-old");
  });
});

describe("문의 저장", () => {
  it("이름, 연락처, 내용이 있으면 저장하고 비어 있으면 거절합니다", () => {
    const saved = parseInquiry({ visitorName: "방문자", visitorContact: "01011112222", message: "오시는 길을 묻습니다" });
    assert.equal(saved.ok, true);
    if (saved.ok) assert.equal(saved.visitorName, "방문자");
    assert.equal(parseInquiry({ visitorName: "", visitorContact: "010", message: "내용" }).ok, false);
  });

  it("푸시 열쇠가 없으면 앱 밖 알림을 준비하지 않습니다", () => {
    assert.equal(inquiryPushReady({}), false);
    assert.equal(inquiryPushReady({ INQUIRY_PUSH_KEY: "  " }), false);
    assert.equal(inquiryPushReady({ INQUIRY_PUSH_KEY: "ready" }), true);
  });
});

describe("검색 노출", () => {
  it("노출이 꺼지면 noindex 이고 켜지면 검색에 나갑니다", () => {
    assert.deepEqual(robotsForSeo(false), { index: false, follow: false });
    assert.deepEqual(robotsForSeo(true), { index: true, follow: true });
  });
});

describe("다가오는 일정", () => {
  it("생일과 공휴일과 다른 공동체 일정을 뺍니다", () => {
    const rows = upcomingPublicEvents(
      [
        {
          id: "event",
          title: "청년 모임",
          startAt: "2026-11-01T10:00:00.000Z",
          category: "EVENT",
          isLeaderOnly: false,
          communityId: "community-a",
        },
        {
          id: "birthday",
          title: "생일",
          startAt: "2026-11-02T10:00:00.000Z",
          category: "BIRTHDAY",
          isLeaderOnly: false,
          communityId: "community-a",
        },
        {
          id: "holiday",
          title: "공휴일",
          startAt: "2026-11-03T10:00:00.000Z",
          category: "HOLIDAY",
          isLeaderOnly: false,
          communityId: "community-a",
        },
        {
          id: "other",
          title: "다른 공동체",
          startAt: "2026-11-04T10:00:00.000Z",
          category: "EVENT",
          isLeaderOnly: false,
          communityId: "community-b",
        },
      ],
      "community-a",
      "2026-10-20T00:00:00.000Z",
    );
    assert.deepEqual(
      rows.map((row) => row.id),
      ["event"],
    );
  });
});
