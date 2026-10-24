import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSeePrayerScope, isPrayerScope, prayerScopeKey, prayerScopeLabel, PRAYER_SCOPES } from "@/prayer/scopes";

describe("기도 범위", () => {
  it("전체, 제주시, 서귀포시, 교회, 모들만 새로 고릅니다", () => {
    assert.deepEqual(
      PRAYER_SCOPES.map((scope) => scope.label),
      ["전체", "제주시", "서귀포시", "교회", "모들"],
    );
    assert.equal(isPrayerScope("all"), true);
    assert.equal(isPrayerScope("jeju"), false);
    assert.equal(isPrayerScope("nation"), false);
    assert.equal(prayerScopeLabel("seogwipo", "PUBLIC"), "서귀포시");
    assert.equal(prayerScopeLabel("jeju", "PUBLIC"), "전체");
    assert.equal(prayerScopeLabel("nation", "PUBLIC"), "전체");
    assert.equal(prayerScopeLabel(null, "LEADER_ONLY"), "");
    assert.equal(prayerScopeLabel(null, "GROUP_ONLY"), "모들");
    assert.equal(prayerScopeKey({ scope: "jeju", churchId: null, groupId: null }), "all");
    assert.equal(prayerScopeKey({ scope: "church", churchId: "c1", groupId: null }), "church:c1");
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
    assert.equal(canSeePrayerScope({ scope: "all", churchId: null, groupId: null, churchIds, groupIds, districts }), true);
    assert.equal(canSeePrayerScope({ scope: "jeju", churchId: null, groupId: null, churchIds, groupIds, districts }), true);
    assert.equal(canSeePrayerScope({ scope: "nation", churchId: null, groupId: null, churchIds, groupIds, districts }), true);
    assert.equal(canSeePrayerScope({ scope: null, churchId: null, groupId: null, churchIds, groupIds, districts }), true);
  });
});
