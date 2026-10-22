import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coordinatesWrittenInAddress, isSameSavedAddress, pickMatchingAddressPoint } from "@/map/address-point";

const SAVED = "서귀포시 남원읍 태위로 360번길 214-1";

describe("저장된 주소 좌표", () => {
  it("같은 번길과 건물번호만 그 주소로 봅니다", () => {
    assert.equal(isSameSavedAddress(SAVED, "제주특별자치도 서귀포시 남원읍 태위로360번길 214-1"), true);
    assert.equal(isSameSavedAddress(SAVED, "대한민국 제주특별자치도 서귀포시 태위로"), false);
    assert.equal(isSameSavedAddress(SAVED, "태위로360번길"), false);
    assert.equal(isSameSavedAddress(SAVED, "태위로360번길 214"), false);
    assert.equal(isSameSavedAddress(SAVED, "태위로360번길 214-10"), false);
  });

  it("주소에 적힌 좌표가 있으면 그 좌표를 쓰고 다른 검색 결과는 쓰지 않습니다", () => {
    const written = coordinatesWrittenInAddress(`${SAVED} (33.2714827, 126.6737485)`);
    assert.deepEqual(written, { lat: 33.2714827, lon: 126.6737485 });
    assert.equal(coordinatesWrittenInAddress(SAVED), null);
    const picked = pickMatchingAddressPoint(`${SAVED} (33.2714827, 126.6737485)`, [
      { label: "태위로", point: { lat: 33.277304, lon: 126.70465 } },
    ]);
    assert.deepEqual(picked, { lat: 33.2714827, lon: 126.6737485 });
  });

  it("상위 도로 좌표로는 핀을 옮기지 않습니다", () => {
    const picked = pickMatchingAddressPoint(SAVED, [
      { label: "대한민국 제주특별자치도 서귀포시 태위로", point: { lat: 33.277304, lon: 126.70465 } },
      { label: "대한민국 제주특별자치도 서귀포시 태위로360번길", point: { lat: 33.272001, lon: 126.684244 } },
      { label: "제주특별자치도 서귀포시 남원읍 태위로360번길 214-1", point: { lat: 33.2714827, lon: 126.6737485 } },
    ]);
    assert.deepEqual(picked, { lat: 33.2714827, lon: 126.6737485 });
  });
});
