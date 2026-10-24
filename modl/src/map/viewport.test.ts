import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pinsForView, type ViewBounds } from "@/map/viewport";

const narrow: ViewBounds = { west: 126.45, south: 33.45, east: 126.55, north: 33.55 };
const wide: ViewBounds = { west: 126.0, south: 33.1, east: 127.0, north: 33.6 };

describe("화면에 보이는 핀", () => {
  const pins = [
    { id: "near", point: { lat: 33.5, lon: 126.5 } },
    { id: "far", point: { lat: 33.2, lon: 126.2 } },
    { id: "beside", point: { lat: 33.501, lon: 126.501 } },
  ];

  it("좁은 화면은 그 안의 핀만 따로 그립니다", () => {
    const drawn = pinsForView(pins, narrow, 12);
    assert.deepEqual(drawn.map((pin) => pin.id), ["near", "beside"]);
    assert.equal(drawn.every((pin) => pin.count === 1), true);
  });

  it("멀리 축소하면 가까운 핀을 묶고 화면 밖은 빼니다", () => {
    const drawn = pinsForView(pins, wide, 8);
    assert.equal(drawn.some((pin) => pin.items.some((item) => item.id === "far")), true);
    const packed = drawn.find((pin) => pin.items.some((item) => item.id === "near"));
    assert.equal(packed?.count, 2);
    assert.ok(drawn.length < pins.length);
  });
});
