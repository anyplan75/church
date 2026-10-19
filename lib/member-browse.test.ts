import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMemberBrowsePath } from "./member-browse";
import { clearGuestChurchId, GUEST_CHURCH_KEY, persistGuestChurchId, readGuestChurchId } from "./guest-church";

describe("성도 비로그인 경로", () => {
  it("/member · /community · /prayers 는 둘러보기 경로입니다", () => {
    assert.equal(isMemberBrowsePath("/member"), true);
    assert.equal(isMemberBrowsePath("/member/"), true);
    assert.equal(isMemberBrowsePath("/community/groups"), true);
    assert.equal(isMemberBrowsePath("/prayers"), true);
    assert.equal(isMemberBrowsePath("/remote"), false);
    assert.equal(isMemberBrowsePath("/login"), false);
  });
});

describe("게스트 교회 저장", () => {
  it("유효한 교회 id 만 저장합니다", () => {
    // @ts-expect-error test stub
    globalThis.localStorage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
    };
    persistGuestChurchId("bad");
    assert.equal(readGuestChurchId(), null);
    persistGuestChurchId("cabc1234");
    assert.equal(readGuestChurchId(), "cabc1234");
    assert.equal(globalThis.localStorage.getItem(GUEST_CHURCH_KEY), "cabc1234");
    clearGuestChurchId();
    assert.equal(readGuestChurchId(), null);
  });
});
