import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSeePrayerScope, isPrayerScope, prayerScopeLabel, PRAYER_SCOPES } from "@/prayer/scopes";

describe("기도 범위", () => {
  it("모들, 교회, 서귀포시, 제주시, 제주도, 전국만 고릅니다", () => {
    assert.deepEqual(
      PRAYER_SCOPES.map((scope) => scope.label),
      ["모들", "교회", "서귀포시", "제주시", "제주도", "전국"],
    );
    assert.equal(isPrayerScope("gathering"), true);
    assert.equal(isPrayerScope("leader"), false);
    assert.equal(prayerScopeLabel("seogwipo", "PUBLIC"), "서귀포시");
    assert.equal(prayerScopeLabel(null, "LEADER_ONLY"), "");
    assert.equal(prayerScopeLabel(null, "GROUP_ONLY"), "모들");
  });

  it("속한 곳과 지역만 보여 줍니다", () => {
    const churchIds = new Set(["c1"]);
    const groupIds = new Set(["g1"]);
    const districts = new Set(["서귀포시"]);
    assert.equal(canSeePrayerScope({ scope: "gathering", churchId: null, groupId: "g1", churchIds, groupIds, districts }), true);
    assert.equal(canSeePrayerScope({ scope: "gathering", churchId: null, groupId: "g2", churchIds, groupIds, districts }), false);
    assert.equal(canSeePrayerScope({ scope: "church", churchId: "c1", groupId: null, churchIds, groupIds, districts }), true);
    assert.equal(canSeePrayerScope({ scope: "church", churchId: "c2", groupId: null, churchIds, groupIds, districts }), false);
    assert.equal(canSeePrayerScope({ scope: "seogwipo", churchId: null, groupId: null, churchIds, groupIds, districts }), true);
    assert.equal(canSeePrayerScope({ scope: "jeju_city", churchId: null, groupId: null, churchIds, groupIds, districts }), false);
    assert.equal(canSeePrayerScope({ scope: "jeju", churchId: null, groupId: null, churchIds, groupIds, districts }), true);
    assert.equal(canSeePrayerScope({ scope: "nation", churchId: null, groupId: null, churchIds, groupIds, districts }), true);
    assert.equal(canSeePrayerScope({ scope: null, churchId: null, groupId: null, churchIds, groupIds, districts }), true);
  });
});
