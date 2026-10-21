import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distanceToLineMeters, followWindowMeters, HERE_RADIUS_METERS, JEJU_VIEW, nearestSegmentIndex, OFF_ROUTE_METERS, radiusView } from "@/map/follow";

describe("지도 확대와 경로 이탈", () => {
  it("제주도 범위는 한반도 전체가 아닙니다", () => {
    assert.ok(JEJU_VIEW.north - JEJU_VIEW.south < 1);
    assert.ok(JEJU_VIEW.east - JEJU_VIEW.west < 2);
    assert.ok(JEJU_VIEW.south > 33);
    assert.ok(JEJU_VIEW.north < 34);
  });

  it("내 위치 반경은 사방 10킬로미터입니다", () => {
    const view = radiusView({ lat: 33.5, lon: 126.5 }, HERE_RADIUS_METERS);
    const latSpan = (view.north - view.south) * 111320;
    assert.ok(Math.abs(latSpan - 20000) < 50);
    assert.equal(OFF_ROUTE_METERS, 100);
  });

  it("길 위에 있으면 가깝고 벗어나면 멉니다", () => {
    const line = [
      { lat: 33.5, lon: 126.5 },
      { lat: 33.5, lon: 126.51 },
    ];
    const onLine = distanceToLineMeters({ lat: 33.5, lon: 126.505 }, line);
    const away = distanceToLineMeters({ lat: 33.502, lon: 126.505 }, line);
    assert.ok(onLine !== null && onLine < 30);
    assert.ok(away !== null && away > OFF_ROUTE_METERS);
    assert.equal(nearestSegmentIndex({ lat: 33.5, lon: 126.505 }, [{ line }]), 0);
    assert.equal(followWindowMeters(20) > followWindowMeters(1), true);
    assert.equal(distanceToLineMeters({ lat: 33.5, lon: 126.5 }, [line[0]]), null);
  });
});
