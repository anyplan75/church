import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schedulesFromBulletin } from "@/calendar/bulletin-schedule";

describe("주보 일정", () => {
  it("예배와 시각이 있는 광고만 넣고 십일조와 헌금은 빼니다", () => {
    const drafts = schedulesFromBulletin({
      label: "주일 2부 예배",
      time: "11:00",
      worshipDate: "2026-10-22",
      sermonTitle: "일정확인설교",
      announcements: ["오후 3시 일정확인모임", "십일조 봉투를 준비해 주세요.", "헌금 안내", "봉헌 시간", "새가족을 환영합니다."].join("\n"),
    });
    assert.deepEqual(
      drafts.map((item) => item.title),
      ["주일 2부 예배", "오후 3시 일정확인모임"],
    );
    assert.equal(drafts[0]?.startAt.toISOString(), "2026-10-22T11:00:00.000Z");
    assert.equal(drafts[0]?.endAt.toISOString(), "2026-10-22T12:30:00.000Z");
    assert.equal(drafts[1]?.startAt.toISOString(), "2026-10-22T15:00:00.000Z");
    assert.equal(JSON.stringify(drafts).includes("십일조"), false);
    assert.equal(JSON.stringify(drafts).includes("헌금"), false);
    assert.equal(JSON.stringify(drafts).includes("봉헌"), false);
  });

  it("광고에 적힌 날짜와 예배 후 일정을 그 예배 날짜에 붙입니다", () => {
    const drafts = schedulesFromBulletin({
      label: "수요기도회",
      time: "19:30",
      worshipDate: "2026-10-21",
      sermonTitle: "",
      announcements: "10월 25일 오후 2시 청년 모임\n예배 후 제직회",
    });
    assert.equal(drafts[1]?.startAt.toISOString(), "2026-10-25T14:00:00.000Z");
    assert.equal(drafts[2]?.startAt.toISOString(), "2026-10-21T21:00:00.000Z");
  });
});
