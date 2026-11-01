import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { churchMatchesTags, normalizeChurchTags } from "@/map/church-tags";

describe("교회 태그 필터", () => {
  const churches = [
    { name: "가", tags: ["초교파", "밴드찬양"] },
    { name: "나", tags: ["예장통합", "전통예배", "영어통역"] },
    { name: "다", tags: ["초교파", "영어통역", "엘리베이터"] },
    { name: "라", tags: [] as string[] },
  ];

  function shown(selected: string[]) {
    const on = new Set(selected);
    return churches.filter((church) => churchMatchesTags(church.tags, on)).map((church) => church.name);
  }

  it("아무것도 안 켜면 태그가 없는 교회까지 모두 나옵니다", () => {
    assert.deepEqual(shown([]), ["가", "나", "다", "라"]);
  });

  it("같은 묶음에서 여러 개를 켜면 그 중 하나라도 있는 교회가 나옵니다", () => {
    assert.deepEqual(shown(["초교파", "예장통합"]), ["가", "나", "다"]);
  });

  it("다른 묶음을 같이 켜면 묶음마다 맞아야 합니다", () => {
    assert.deepEqual(shown(["초교파", "영어통역"]), ["다"]);
    assert.deepEqual(shown(["초교파", "밴드찬양"]), ["가"]);
    assert.deepEqual(shown(["초교파", "밴드찬양", "엘리베이터"]), []);
  });

  it("태그가 없는 교회는 필터를 켜면 빠집니다", () => {
    assert.deepEqual(shown(["엘리베이터"]), ["다"]);
  });

  it("모르는 태그와 중복은 저장하지 않습니다", () => {
    assert.deepEqual(normalizeChurchTags(["초교파", "초교파", "제주시", "영어통역"]), ["초교파", "영어통역"]);
  });
});
