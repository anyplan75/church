import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterByName } from "@/map/church-search";

describe("교회 이름 검색", () => {
  const rows = [{ name: "남원교회" }, { name: "제주교회" }, { name: "서귀포남원" }];

  it("이름을 적기 전에는 목록 전체를 돌려주지 않습니다", () => {
    assert.deepEqual(filterByName(rows, ""), []);
    assert.deepEqual(filterByName(rows, "   "), []);
  });

  it("교회 이름이 들어간 곳만 고릅니다", () => {
    assert.deepEqual(
      filterByName(rows, "남원").map((row) => row.name),
      ["남원교회", "서귀포남원"],
    );
    assert.deepEqual(filterByName(rows, "없는교회"), []);
  });
});
