import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cityFromStored, regionFromAddress } from "@/map/region";

describe("교회 지역", () => {
  it("주소에 시 이름이 하나일 때만 제주시 또는 서귀포시로 채웁니다", () => {
    const jeju = regionFromAddress("제주특별자치도 제주시 일도일동 1");
    assert.deepEqual(jeju, { sido: "제주", district: "제주시", regionId: "제주-제주시" });
    const seogwipo = regionFromAddress("서귀포시 중문");
    assert.deepEqual(seogwipo, { sido: "제주", district: "서귀포시", regionId: "제주-서귀포시" });
    assert.equal(regionFromAddress("12 Seogwipo-ro, Seogwipo, Jeju")?.district, "서귀포시");
    assert.equal(regionFromAddress("Jeju-si")?.district, "제주시");
  });

  it("시 이름이 없거나 둘 다 있으면 비웁니다", () => {
    assert.equal(regionFromAddress("제주도"), null);
    assert.equal(regionFromAddress("Jeju"), null);
    assert.equal(regionFromAddress("제주시 서귀포시"), null);
    assert.equal(regionFromAddress("Jeju-si Seogwipo"), null);
    assert.equal(regionFromAddress(""), null);
    assert.equal(regionFromAddress("제주 시"), null);
  });

  it("저장된 지역 키가 어긋나면 시로 보지 않습니다", () => {
    assert.equal(cityFromStored("제주", "제주시", "제주-제주시"), "제주시");
    assert.equal(cityFromStored("제주", "제주시", "제주"), null);
    assert.equal(cityFromStored(null, null, null), null);
  });
});
