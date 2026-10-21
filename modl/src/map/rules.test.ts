import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSeePickupPin } from "@/map/access";
import { MAPBOX_ALLOWED_ORIGIN } from "@/map/origin";
import { parseMapboxGeocode, parseMatch, parseNearest, parsePlaces, parseRoute, placeKind } from "@/map/rules";

describe("장소 구분", () => {
  it("식당과 숙소 태그만 구분하고 나머지는 비웁니다", () => {
    assert.equal(placeKind("amenity", "restaurant"), "restaurant");
    assert.equal(placeKind("amenity", "fast_food"), "restaurant");
    assert.equal(placeKind("tourism", "hotel"), "lodging");
    assert.equal(placeKind("tourism", "guest_house"), "lodging");
    assert.equal(placeKind("amenity", "school"), null);
    assert.equal(placeKind("amenity", "cafe"), null);
    assert.equal(placeKind("building", "yes"), null);
  });

  it("검색 응답에서 식당과 숙소만 남기고 위치는 바꾸지 않습니다", () => {
    const hits = parsePlaces([
      {
        place_id: 1,
        lat: "33.5",
        lon: "126.5",
        category: "amenity",
        type: "restaurant",
        name: "재영 식당",
        display_name: "재영 식당, 제주시",
      },
      {
        place_id: 2,
        lat: "33.4",
        lon: "126.4",
        category: "tourism",
        type: "hotel",
        name: "바다 여관",
        display_name: "바다 여관, 제주시",
      },
      {
        place_id: 3,
        lat: "33.1",
        lon: "126.1",
        category: "amenity",
        type: "school",
        name: "학교",
        display_name: "학교",
      },
      {
        place_id: 4,
        lat: "99",
        lon: "126",
        category: "amenity",
        type: "restaurant",
        name: "잘못된 좌표",
        display_name: "없음",
      },
    ]);
    assert.deepEqual(
      hits.map((hit) => hit.kind),
      ["restaurant", "lodging"],
    );
    assert.equal(hits[0]?.point.lat, 33.5);
    assert.equal(hits[0]?.point.lon, 126.5);
    assert.equal(parsePlaces({ fake: true }).length, 0);
  });
});

describe("길 응답", () => {
  it("가까운 길 좌표는 경도 위도 순서를 위도 경도로 바꿉니다", () => {
    assert.deepEqual(parseNearest({ code: "Ok", waypoints: [{ location: [126.53, 33.49] }] }), {
      lat: 33.49,
      lon: 126.53,
    });
    assert.equal(parseNearest({ code: "NoSegment", waypoints: [] }), null);
  });

  it("붙지 않은 점은 비워 두고 선을 읽습니다", () => {
    const snap = parseMatch({
      code: "Ok",
      tracepoints: [{ location: [126.5, 33.5] }, null],
      matchings: [{ geometry: { type: "LineString", coordinates: [[126.5, 33.5], [126.6, 33.6]] } }],
    });
    assert.deepEqual(snap?.snapped[0], { lat: 33.5, lon: 126.5 });
    assert.equal(snap?.snapped[1], null);
    assert.equal(snap?.line.length, 2);
    assert.equal(parseMatch({ code: "NoMatch", tracepoints: [] }), null);
  });

  it("경로가 없으면 선을 만들지 않습니다", () => {
    const route = parseRoute({
      code: "Ok",
      routes: [{ distance: 1200, duration: 180, geometry: { coordinates: [[126.5, 33.5], [126.6, 33.6]] } }],
    });
    assert.equal(route?.line.length, 2);
    assert.equal(route?.distanceMeters, 1200);
    assert.equal(parseRoute({ code: "NoRoute", routes: [] }), null);
  });

  it("맵박스 좌표는 응답에 있는 것만 읽고 없으면 비웁니다", () => {
    assert.deepEqual(parseMapboxGeocode({ features: [{ center: [126.97, 37.56] }] }), { lat: 37.56, lon: 126.97 });
    assert.equal(parseMapboxGeocode({ features: [] }), null);
    assert.equal(parseMapboxGeocode({}), null);
  });
});

describe("지도 출처", () => {
  it("허용 주소는 경로와 별표가 없는 한 줄입니다", () => {
    assert.equal(MAPBOX_ALLOWED_ORIGIN, "https://modl--modl-comm.asia-east1.hosted.app");
    assert.equal(new URL(MAPBOX_ALLOWED_ORIGIN).pathname, "/");
    assert.equal(MAPBOX_ALLOWED_ORIGIN.includes("*"), false);
  });
});

describe("데리러 가기 핀", () => {
  it("본인과 사역자와 임원만 봅니다", () => {
    assert.equal(canSeePickupPin({ viewerUserId: "me", viewerRole: "MEMBER", pinUserId: "me" }), true);
    assert.equal(canSeePickupPin({ viewerUserId: "me", viewerRole: "MEMBER", pinUserId: "other" }), false);
    assert.equal(canSeePickupPin({ viewerUserId: "me", viewerRole: "PASTOR", pinUserId: "other" }), true);
    assert.equal(canSeePickupPin({ viewerUserId: "me", viewerRole: "EXECUTIVE", pinUserId: "other" }), true);
    assert.equal(canSeePickupPin({ viewerUserId: null, viewerRole: null, pinUserId: "other" }), false);
  });
});
