import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanPromo, subscriptionMenus } from "@/promo/rules";

describe("홍보 페이지", () => {
  it("구독한 교회와 모들만 메뉴가 되고 비어 있으면 메뉴가 없습니다", () => {
    assert.deepEqual(subscriptionMenus([], []), []);
    assert.deepEqual(subscriptionMenus([{ id: "c1", name: "남원교회" }], []), [
      { href: "/promo/church/c1", label: "남원교회", kind: "church" },
    ]);
    assert.deepEqual(subscriptionMenus([], [{ id: "g1", name: "청년모들" }]), [
      { href: "/promo/gathering/g1", label: "청년모들", kind: "gathering" },
    ]);
    assert.deepEqual(
      subscriptionMenus([{ id: "c1", name: "남원교회" }], [{ id: "g1", name: "청년모들" }]).map((item) => item.kind),
      ["church", "gathering"],
    );
  });

  it("게시판 탭은 3개까지이고 일정과 재정 칸은 없습니다", () => {
    const four = cleanPromo({
      instagram: "modl",
      youtube: [{ title: "예배", url: "https://youtu.be/abc" }],
      tabs: [
        { title: "소식", posts: [{ title: "글", body: "내용" }] },
        { title: "앨범", posts: [] },
        { title: "기도", posts: [] },
        { title: "넷", posts: [] },
      ],
    });
    assert.equal(four.ok, false);
    const kept = cleanPromo({
      instagram: "@modl.jeju",
      youtube: [{ title: "", url: "" }, { title: "설교", url: "https://www.youtube.com/watch?v=abc" }],
      tabs: [{ title: "소식", posts: [{ title: "환영", body: "오십시오" }, { title: "", body: "" }] }],
    });
    assert.equal(kept.ok, true);
    if (!kept.ok) return;
    assert.equal(kept.content.tabs.length, 1);
    assert.equal(kept.content.youtube.length, 1);
    assert.equal("calendar" in kept.content, false);
    assert.equal(JSON.stringify(kept.content).includes("일정"), false);
  });
});
