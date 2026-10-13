import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canOpenPath, type Role } from "./roles.ts";
import { isItemPhoto, oneLine, resolveDepartment } from "./supplies.ts";
import type { Department } from "./types.ts";

describe("부서 물품", () => {
  const departments: Department[] = [
    { id: "dept-worship", name: "예배부" },
    { id: "dept-edu", name: "교육부" },
  ];

  it("이름은 한 줄이고 사진이 있어야 한다", () => {
    assert.equal(oneLine("  접이식\n의자  ", 40), "접이식 의자");
    assert.equal(oneLine("\n", 40), "");
    assert.equal(isItemPhoto(`data:image/jpeg;base64,${"a".repeat(40)}`), true);
    assert.equal(isItemPhoto(""), false);
    assert.equal(isItemPhoto("data:image/gif;base64,aaaa"), false);
  });

  it("부서는 고르거나 새로 넣는다", () => {
    const picked = resolveDepartment(departments, "dept-edu", "");
    assert.equal(picked?.id, "dept-edu");
    assert.equal(picked?.departments.length, 2);
    const same = resolveDepartment(departments, "dept-worship", " 교육부 ");
    assert.equal(same?.id, "dept-edu");
    const created = resolveDepartment(departments, "", "청년부");
    assert.equal(created?.departments.length, 3);
    assert.equal(created?.departments[2]?.name, "청년부");
    assert.equal(resolveDepartment(departments, "missing", "  "), null);
  });

  it("물품 화면은 보기와 준비에 열리고 송출만으로는 열리지 않는다", () => {
    assert.equal(canOpenPath(["view"] satisfies Role[], "/inventory"), true);
    assert.equal(canOpenPath(["prepare"], "/inventory"), true);
    assert.equal(canOpenPath(["output"], "/inventory"), false);
  });
});
