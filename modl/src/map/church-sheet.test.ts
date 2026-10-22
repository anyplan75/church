import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHURCH_HEADERS, parseChurchRows } from "@/map/church-sheet";

const header = [...CHURCH_HEADERS];

describe("교회 엑셀", () => {
  it("정해진 칸 이름과 순서만 받습니다", () => {
    const parsed = parseChurchRows([
      header,
      ["한빛교회", "김목사", "제주시 일도일동 1", "064-000-0000", "주일 11시", "본당"],
      ["", "", "", "", "", ""],
    ]);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.churches.length, 1);
    assert.equal(parsed.churches[0]?.name, "한빛교회");
    assert.equal(parsed.churches[0]?.pastorName, "김목사");
    assert.equal(parsed.churches[0]?.address, "제주시 일도일동 1");
    assert.equal(parsed.churches[0]?.serviceTime, "주일 11시");
  });

  it("주소가 비어도 교회는 남기고 칸 이름이 다르면 거절합니다", () => {
    const parsed = parseChurchRows([header, ["바다교회", "이목사", "", "", "주일 10시", ""]]);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.churches[0]?.address, "");
    const wrong = parseChurchRows([["이름", "목사", "주소", "전화", "시간", "메모"], ["없는교회", "", "", "", "", ""]]);
    assert.equal(wrong.ok, false);
  });

  it("교회 이름이 없으면 줄을 만들지 않습니다", () => {
    const parsed = parseChurchRows([header, ["", "김목사", "제주시", "", "", ""]]);
    assert.equal(parsed.ok, false);
  });
});
