import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_NEARBY_RADIUS_KM,
  churchLocationFromInput,
  distanceKm,
  filterNearbyChurches,
  formatDistanceKm,
  isValidGeoPoint,
} from "./geo.ts";

describe("좌표 검사", () => {
  it("위도·경도 범위를 확인한다", () => {
    assert.equal(isValidGeoPoint({ lat: 33.25, lng: 126.56 }), true);
    assert.equal(isValidGeoPoint({ lat: 91, lng: 126 }), false);
    assert.equal(isValidGeoPoint({ lat: 33, lng: Number.NaN }), false);
    assert.equal(isValidGeoPoint(null), false);
  });
});

describe("거리 계산", () => {
  it("같은 지점은 0km에 가깝다", () => {
    const p = { lat: 33.4996, lng: 126.5312 };
    assert.ok(distanceKm(p, p) < 0.001);
  });

  it("제주 시내~서귀포 대략 거리를 계산한다", () => {
    const jeju = { lat: 33.4996, lng: 126.5312 };
    const seogwipo = { lat: 33.2541, lng: 126.5601 };
    const km = distanceKm(jeju, seogwipo);
    assert.ok(km > 25 && km < 35, `got ${km}`);
  });
});

describe("주변 교회 필터", () => {
  const origin = { lat: 33.5, lng: 126.5 };
  const churches = [
    { id: "cnear001", name: "가까운교회", lat: 33.51, lng: 126.51, address: "제주시" },
    { id: "cfar0001", name: "먼교회", lat: 35.0, lng: 129.0, address: "부산" },
    { id: "cnolat01", name: "좌표없음", address: "주소만" },
    { id: "cnear002", name: "아주가까운", lat: 33.501, lng: 126.501 },
  ];

  it("반경 안 교회만 가까운 순으로 고른다", () => {
    const nearby = filterNearbyChurches(churches, origin, 20);
    assert.equal(nearby.length, 2);
    assert.equal(nearby[0]?.id, "cnear002");
    assert.equal(nearby[1]?.id, "cnear001");
    assert.ok(nearby[0]!.distanceKm < nearby[1]!.distanceKm);
  });

  it("기본 반경 상수를 쓴다", () => {
    assert.equal(DEFAULT_NEARBY_RADIUS_KM, 15);
    const nearby = filterNearbyChurches(churches, origin);
    assert.equal(nearby.length, 2);
  });

  it("좁은 반경에서는 더 적게 고른다", () => {
    const nearby = filterNearbyChurches(churches, origin, 0.5);
    assert.equal(nearby.length, 1);
    assert.equal(nearby[0]?.id, "cnear002");
  });
});

describe("거리 표시", () => {
  it("미터·킬로미터 글자로 바꾼다", () => {
    assert.equal(formatDistanceKm(0.35), "350m");
    assert.equal(formatDistanceKm(3.2), "3.2km");
    assert.equal(formatDistanceKm(18.4), "18km");
  });
});

describe("교회 주소·좌표 정리", () => {
  it("주소와 유효한 좌표만 남긴다", () => {
    assert.deepEqual(churchLocationFromInput({ address: "  제주시  ", lat: "33.5", lng: "126.5" }), {
      address: "제주시",
      lat: 33.5,
      lng: 126.5,
    });
    assert.deepEqual(churchLocationFromInput({ address: "   ", lat: 91, lng: 126 }), {});
    assert.deepEqual(churchLocationFromInput({ address: "주소만" }), { address: "주소만" });
  });
});
