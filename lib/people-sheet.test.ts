import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { commitPeopleImport, parseCsv, planPeopleImport, rowsFromMatrix } from "./people-sheet.ts";
import type { Person } from "./types.ts";

function person(partial: Partial<Person> & Pick<Person, "id" | "name" | "phone">): Person {
  return {
    roles: [],
    active: true,
    membership: "member",
    attendanceConsent: false,
    category: "registered",
    office: "",
    ...partial,
  };
}

describe("사람 엑셀", () => {
  it("사진 칸은 이름 앞이고, 이름과 전화번호가 같으면 겹친 줄로 보여 준다", () => {
    const matrix = parseCsv("사진,이름,전화번호,구분,직분,주소\n,김은혜,010-1111-2222,사역자,목사,서귀포\n,오은총,010-3333-4444,미등록교인,,제주\n,오은총,01033334444,등록교인,권사,서울\n");
    const rows = rowsFromMatrix(matrix, new Map());
    assert.equal(rows[0]?.name, "김은혜");
    assert.equal(rows[0]?.office, "목사");
    assert.equal(rows[0]?.category, "minister");
    assert.equal(rows[0]?.row, 2);
    assert.equal(rows[1]?.category, "unregistered");
    const people = [person({ id: "p1", name: "김은혜", phone: "01011112222", address: "옛 주소" })];
    const plan = planPeopleImport(people, rows);
    assert.equal(plan.fresh.length, 1);
    assert.equal(plan.fresh[0]?.name, "오은총");
    assert.equal(plan.overlaps.length, 2);
    assert.equal(plan.overlaps[0]?.personId, "p1");
    assert.equal(plan.overlaps[1]?.matchRow, 3);
    const skipped = commitPeopleImport(people, [], rows, "skip");
    assert.deepEqual(skipped.people.map((item) => item.name), ["김은혜", "오은총"]);
    assert.equal(skipped.people[0]?.address, "옛 주소");
    assert.equal(skipped.people[1]?.membership, "visitor");
    const updated = commitPeopleImport(people, [{ personId: "p1", week: "2026-10-11", present: true }], rows, "update");
    assert.equal(updated.people.length, 2);
    assert.equal(updated.people[0]?.office, "목사");
    assert.equal(updated.people[0]?.address, "서귀포");
    assert.equal(updated.updated, 1);
    assert.equal(updated.attendance.length, 1);
  });
});
