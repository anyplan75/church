import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { churchPath } from "./firebase-db.ts";
import { canAddChurch, canSeeChurch, isChurchId, makeChurchId, visibleChurchIds } from "./platform.ts";

const bannedPasswordHash = "ef03c004170e044bca7ca88729a9bbe0cf47182d3a39d92cccc31da102981559";

describe("교회 경로", () => {
  it("데이터는 church 경로만 가리킨다", () => {
    assert.equal(churchPath("churchIndex/c1234567"), "church/churchIndex/c1234567");
    assert.equal(churchPath("church/churches/c1234567/data"), "church/churches/c1234567/data");
  });

  it("통역 저장소의 경로는 거부한다", () => {
    assert.throws(() => churchPath("live-interpret/admin/uid"), /live-interpret/);
    assert.throws(() => churchPath("cheil"), /cheil/);
    assert.throws(() => churchPath("jifc/sessions"), /jifc/);
    assert.throws(() => churchPath("churches/../cheil"), /잘못된/);
    assert.throws(() => churchPath(""), /빈/);
  });
});

describe("교회 범위", () => {
  const ids = ["c1234567", "c7654321"];

  it("전체 운영자는 교회를 추가하고 같은 목록을 본다", () => {
    const actor = { kind: "platform" as const, churchId: null };
    assert.equal(canAddChurch(actor), true);
    assert.deepEqual(visibleChurchIds(actor, ids), ids);
  });

  it("교회 운영자는 자기 교회만 보고 교회를 추가하지 못한다", () => {
    const actor = { kind: "church" as const, churchId: "c1234567" };
    assert.equal(canAddChurch(actor), false);
    assert.equal(canSeeChurch(actor, "c1234567"), true);
    assert.equal(canSeeChurch(actor, "c7654321"), false);
    assert.deepEqual(visibleChurchIds(actor, ids), ["c1234567"]);
    assert.equal(canSeeChurch(actor, "cheil"), false);
  });

  it("교회 아이디는 church 경로에 안전한 값만 허용한다", () => {
    assert.equal(isChurchId("c1234567"), true);
    assert.equal(isChurchId("cheil"), false);
    assert.equal(isChurchId("live-interpret"), false);
    assert.equal(isChurchId(makeChurchId()), true);
  });
});

describe("비밀번호", () => {
  it("저장소와 공개 소스에 평문 비밀번호가 없다", () => {
    const roots = ["app", "components", "lib", "firebase", "scripts", "README.md"];
    for (const root of roots) {
      const full = path.join(process.cwd(), root);
      if (!fs.existsSync(full)) continue;
      walk(full, (file) => {
        if (!/\.(ts|tsx|js|mjs|json|md)$/.test(file)) return;
        const text = fs.readFileSync(file, "utf8");
        for (const match of text.matchAll(/["'`]([^"'`\n]{6,80})["'`]/g)) {
          const hash = createHash("sha256").update(match[1]).digest("hex");
          assert.notEqual(hash, bannedPasswordHash, file);
        }
      });
    }
  });
});

function walk(target: string, visit: (file: string) => void) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    visit(target);
    return;
  }
  for (const name of fs.readdirSync(target)) {
    if (name === "node_modules" || name === ".next" || name === "out") continue;
    walk(path.join(target, name), visit);
  }
}
