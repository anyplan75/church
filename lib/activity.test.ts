import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeDbChange, pushActivity } from "./activity.ts";
import { buildSeed } from "./seed.ts";

describe("작업 기록", () => {
  it("순서와 출석 변경은 남기고 본문은 남기지 않는다", () => {
    const before = buildSeed("2026-10-14");
    const after = buildSeed("2026-10-14");
    after.services[1].liveIndex = 1;
    assert.match(describeDbChange(before, after) || "", /그룹으로 건너뜀/);
    assert.equal((describeDbChange(before, after) || "").includes("이사야"), false);

    const withBody = buildSeed("2026-10-14");
    withBody.services[0].items[0].scriptureText = "창세기 본문 전문이면 기록에 들어가면 안 된다";
    withBody.services[0].items[0].scriptureLicensed = true;
    withBody.songs[0].permittedLine = "찬송 가사 한 절";
    const vague = describeDbChange(before, withBody) || "";
    assert.equal(vague, "화면 문구 설정을 바꿈");
    assert.equal(vague.includes("창세기"), false);
    assert.equal(vague.includes("찬송 가사"), false);
  });

  it("기록 문장에서 긴 본문을 잘라 낸다", () => {
    const db = buildSeed("2026-10-14");
    const entry = pushActivity(db, "Operator@Church.org", `출석을 바꿈 ${"가".repeat(400)}`);
    assert.equal(entry?.email, "operator@church.org");
    assert.equal(entry && entry.action.length <= 140, true);
    assert.equal(db.activity[0]?.id, entry?.id);
  });
});
