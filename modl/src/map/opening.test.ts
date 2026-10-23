import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JEJU_VIEW, HERE_RADIUS_METERS, SERVICE_FOCUS } from "@/map/follow";
import { REGION_FOCUS, openingFocus, openingSpanKm } from "@/map/opening";

describe("지도가 처음 여는 범위", () => {
  it("기본은 반경 10km이고 제주도 전체보다 좁습니다", () => {
    const opening = openingSpanKm(SERVICE_FOCUS);
    const island = (JEJU_VIEW.north - JEJU_VIEW.south) * 111.32;
    assert.ok(Math.abs(opening - (HERE_RADIUS_METERS * 2) / 1000) < 1);
    assert.ok(opening < island / 2);
    assert.equal(openingFocus({}).source, "service");
    assert.equal(openingFocus({}).point, SERVICE_FOCUS);
  });

  it("주소 좌표, 지역, 내가 갈 교회 순으로 고릅니다", () => {
    const address = { lat: 33.25, lon: 126.41 };
    const home = { lat: 33.48, lon: 126.49 };
    assert.equal(openingFocus({ addressPoint: address, addressText: "서귀포시", homeChurchPoint: home }).source, "address");
    assert.deepEqual(openingFocus({ addressText: "제주특별자치도 서귀포시 태위로", homeChurchPoint: home }).point, REGION_FOCUS.서귀포시);
    assert.equal(openingFocus({ addressText: "서귀포시 어딘가", homeChurchPoint: home }).source, "region");
    assert.deepEqual(openingFocus({ addressText: "", homeChurchPoint: home }).point, home);
    assert.equal(openingFocus({ homeChurchPoint: home }).source, "home-church");
    assert.equal(openingFocus({ addressText: "서울특별시" }).source, "service");
  });
});
