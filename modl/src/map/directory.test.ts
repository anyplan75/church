import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directoryEmptyNote, directoryHits } from "@/map/directory";

describe("지도에서 교회와 모들 검색", () => {
  const churches = [{ id: "c1", name: "남원교회", address: "서귀포시 남원읍" }];
  const gatherings = [{ id: "g1", name: "남원 모들", address: "서귀포시" }];

  it("이름에 맞는 교회와 모들만 결과에 둡니다", () => {
    assert.deepEqual(directoryHits("남원", churches, gatherings), [
      { kind: "church", id: "c1", name: "남원교회", address: "서귀포시 남원읍" },
      { kind: "gathering", id: "g1", name: "남원 모들", address: "서귀포시" },
    ]);
    assert.deepEqual(directoryHits("없는곳", churches, gatherings), []);
    assert.equal(directoryEmptyNote, "교회나 모들로 찾은 결과가 없습니다.");
    assert.equal(directoryEmptyNote.includes("식당"), false);
    assert.equal(directoryEmptyNote.includes("숙소"), false);
    assert.deepEqual(directoryHits("  ", churches, gatherings), []);
  });
});
