import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isJejuPoint,
  nearbyStations,
  parseArrivals,
  parsePassingRoutes,
  parseStations,
  shapeStop,
} from "@/map/jeju-bus";

const stationXml = `<?xml version="1.0"?>
<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>
<item><localX>126.521348</localX><localY>33.499916</localY><stationId>405000151</stationId><stationNm><![CDATA[용천마을]]></stationNm></item>
<item><stationId>1</stationId><stationNm>좌표없음</stationNm></item>
<item><localX>127.0</localX><localY>37.5</localY><stationId>2</stationId><stationNm>서울역</stationNm></item>
</items></body></response>`;

describe("제주 버스 응답", () => {
  it("좌표와 이름이 있는 제주 정류장만 남깁니다", () => {
    const stations = parseStations(stationXml);
    assert.equal(stations.length, 1);
    assert.equal(stations[0]?.name, "용천마을");
    assert.equal(stations[0]?.point.lat, 33.499916);
    assert.equal(stations[0]?.point.lon, 126.521348);
    assert.equal(parseStations("<response><header><resultCode>99</resultCode></header></response>").length, 0);
  });

  it("제주가 아닌 곳은 버스 안내 범위 밖입니다", () => {
    assert.equal(isJejuPoint({ lat: 33.49, lon: 126.53 }), true);
    assert.equal(isJejuPoint({ lat: 37.56, lon: 126.97 }), false);
  });

  it("도착과 운행 노선은 응답에 있는 것만 보여 줍니다", () => {
    const now = Date.parse("2026-10-21T12:10:00+09:00");
    const arrivals = parseArrivals(
      `<response><header><resultCode>00</resultCode></header><body><items>
<item><routeId>405</routeId><predictTravTm>5</predictTravTm><leftStation>2</leftStation><calcDate>2026-10-21T12:00:00+09:00</calcDate></item>
<item><routeId>406</routeId><predictTravTm>0</predictTravTm><leftStation>0</leftStation><calcDate>2026-10-21T12:00:00+09:00</calcDate></item>
<item><routeId>407</routeId><predictTravTm>4</predictTravTm><leftStation>1</leftStation><calcDate>2022-07-20T17:40:14+09:00</calcDate></item>
</items></body></response>`,
      now,
    );
    assert.equal(arrivals.length, 1);
    assert.equal(arrivals[0]?.minutes, 5);
    const passing = parsePassingRoutes(`<response><header><resultCode>00</resultCode></header><body><items>
<item><routeId>405</routeId><useYn>Y</useYn></item>
<item><routeId>406</routeId><useYn>N</useYn></item>
</items></body></response>`);
    assert.deepEqual(passing.map((route) => route.routeId), ["405"]);
    const station = parseStations(stationXml)[0];
    assert.ok(station);
    const shaped = shapeStop(station, arrivals, passing, new Map([["405", "365 용천"]]));
    assert.deepEqual(shaped.routes, ["365 용천"]);
    assert.equal(shaped.arrivals[0]?.label, "365 용천");
    const far = nearbyStations([station], { lat: 33.2, lon: 126.2 });
    assert.equal(far.length, 0);
    assert.equal(nearbyStations([station], station.point).length, 1);
  });
});
