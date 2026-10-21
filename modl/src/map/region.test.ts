import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cityFromStored, regionFromAddress } from "@/map/region";

describe("교회 지역", () => {
  it("주소의 지명으로 제주시 또는 서귀포시를 채웁니다", () => {
    const jeju = regionFromAddress("제주특별자치도 제주시 일도일동 1");
    assert.deepEqual(jeju, { sido: "제주", district: "제주시", regionId: "제주-제주시" });
    const seogwipo = regionFromAddress("서귀포시 중문");
    assert.deepEqual(seogwipo, { sido: "제주", district: "서귀포시", regionId: "제주-서귀포시" });
    assert.equal(regionFromAddress("Jocheon-ri, Jeju")?.district, "제주시");
    assert.equal(regionFromAddress("애월읍")?.district, "제주시");
    assert.equal(regionFromAddress("한림")?.district, "제주시");
    assert.equal(regionFromAddress("구좌")?.district, "제주시");
    assert.equal(regionFromAddress("연동")?.district, "제주시");
    assert.equal(regionFromAddress("Hallimjungang-ro, Jeju")?.district, "제주시");
    assert.equal(regionFromAddress("Hanrim-ri, Jeju")?.district, "제주시");
    assert.equal(regionFromAddress("Ido 2-dong, Jeju")?.district, "제주시");
    assert.equal(regionFromAddress("Oedo 1-dong, Jeju")?.district, "제주시");
    assert.equal(regionFromAddress("Jeju-si")?.district, "제주시");
    assert.equal(regionFromAddress("Gwandeok-ro, Jeju")?.district, "제주시");
    assert.equal(regionFromAddress("Jeju")?.district, "제주시");
    assert.equal(regionFromAddress("제주도")?.district, "제주시");
    assert.equal(regionFromAddress("표선면")?.district, "서귀포시");
    assert.equal(regionFromAddress("Namwon-eup")?.district, "서귀포시");
    assert.equal(regionFromAddress("Seongsan")?.district, "서귀포시");
    assert.equal(regionFromAddress("대정")?.district, "서귀포시");
    assert.equal(regionFromAddress("예래")?.district, "서귀포시");
    assert.equal(regionFromAddress("색달")?.district, "서귀포시");
  });

  it("서귀포 주소에 제주가 같이 있어도 서귀포시입니다", () => {
    assert.equal(regionFromAddress("12 Seogwipo-ro, Seogwipo, Jeju")?.district, "서귀포시");
    assert.equal(regionFromAddress("제주특별자치도 서귀포시 중문동")?.district, "서귀포시");
  });

  it("두 시가 겹치거나 지명을 못 읽으면 비웁니다", () => {
    assert.equal(regionFromAddress("제주시 서귀포시"), null);
    assert.equal(regionFromAddress("Jeju-si Seogwipo"), null);
    assert.equal(regionFromAddress("조천 서귀포"), null);
    assert.equal(regionFromAddress(""), null);
    assert.equal(regionFromAddress("서울시 강남구"), null);
  });

  it("저장된 지역 키가 어긋나면 시로 보지 않습니다", () => {
    assert.equal(cityFromStored("제주", "제주시", "제주-제주시"), "제주시");
    assert.equal(cityFromStored("제주", "제주시", "제주"), null);
    assert.equal(cityFromStored(null, null, null), null);
  });
});
