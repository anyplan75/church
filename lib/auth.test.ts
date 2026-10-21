import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { serviceSaveBlock } from "./access.ts";
import {
  accountsFile,
  addAccount,
  createFirstAccount,
  deleteAccount,
  deleteAccountError,
  readAccounts,
  roleChangeError,
  updateAccount,
} from "./accounts.ts";
import { verifyPassword } from "./passwords.ts";
import { ALL_ROLES, ROLES, can, canOpenPath, type Role } from "./roles.ts";
import type { Service } from "./types.ts";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "church-auth-"));
const previousDataDir = process.env.CHURCH_DATA_DIR;

before(() => {
  process.env.CHURCH_DATA_DIR = directory;
});

after(() => {
  if (previousDataDir === undefined) delete process.env.CHURCH_DATA_DIR;
  else process.env.CHURCH_DATA_DIR = previousDataDir;
  fs.rmSync(directory, { recursive: true, force: true });
});

function worship(partial: Partial<Service> = {}): Service {
  return {
    id: partial.id ?? "service-1",
    title: partial.title ?? "주일 2부 예배",
    date: partial.date ?? "2026-10-18",
    time: partial.time ?? "11:00",
    type: partial.type ?? "sunday-2",
    place: partial.place ?? "본당",
    preacherId: partial.preacherId ?? null,
    status: partial.status ?? "planning",
    items: partial.items ?? [],
    announcements: partial.announcements ?? [],
    liveIndex: partial.liveIndex ?? 0,
    startedAt: partial.startedAt ?? null,
    notes: partial.notes ?? "",
    checks: partial.checks ?? {},
    source: partial.source ?? "manual",
  };
}

describe("역할 조합", () => {
  const mutations = ["mutate.prepare", "mutate.run", "mutate.output", "mutate.directory", "mutate.admin"] as const;

  it("역할을 전부 가지면 수정이 모두 허용된다", () => {
    for (const capability of mutations) {
      assert.equal(can(ALL_ROLES, capability), true);
    }
    assert.equal(canOpenPath(ALL_ROLES, "/services/service-1"), true);
    assert.equal(canOpenPath(ALL_ROLES, "/people"), true);
    assert.equal(canOpenPath(ALL_ROLES, "/settings"), true);
    assert.equal(serviceSaveBlock(ALL_ROLES, worship(), worship({ title: "특별 예배" })), null);
    assert.equal(serviceSaveBlock(ALL_ROLES, worship(), worship({ status: "live", startedAt: "2026-10-18T02:00:00.000Z" })), null);
  });

  it("보기와 송출 두 역할은 그 화면만 열고 순서와 사람 수정은 거부한다", () => {
    const roles: Role[] = ["view", "output"];
    assert.equal(can(roles, "screen.week"), true);
    assert.equal(can(roles, "screen.bulletin"), true);
    assert.equal(can(roles, "screen.output"), true);
    assert.equal(can(roles, "screen.slides"), true);
    assert.equal(can(roles, "mutate.output"), true);
    assert.equal(can(roles, "mutate.prepare"), false);
    assert.equal(can(roles, "mutate.directory"), false);
    assert.equal(can(roles, "mutate.run"), false);
    assert.equal(can(roles, "mutate.admin"), false);
    assert.equal(canOpenPath(roles, "/"), true);
    assert.equal(canOpenPath(roles, "/services"), true);
    assert.equal(canOpenPath(roles, "/services/service-1/bulletin"), true);
    assert.equal(canOpenPath(roles, "/services/service-1/output"), true);
    assert.equal(canOpenPath(roles, "/services/service-1/slides"), true);
    assert.equal(canOpenPath(roles, "/services/service-1"), false);
    assert.equal(canOpenPath(roles, "/people"), false);
    assert.equal(canOpenPath(roles, "/songs"), false);
    assert.equal(canOpenPath(roles, "/prepare"), false);
    assert.equal(canOpenPath(roles, "/settings"), false);
    assert.equal(serviceSaveBlock(roles, worship(), worship({ title: "순서를 바꿈" })), "권한이 없습니다.");
    assert.equal(serviceSaveBlock(roles, worship(), worship({ place: "교육관" })), "권한이 없습니다.");
  });

  it("보기만 있으면 어떤 수정이든 거부한다", () => {
    const roles: Role[] = ["view"];
    for (const capability of mutations) {
      assert.equal(can(roles, capability), false);
    }
    assert.equal(serviceSaveBlock(roles, worship(), worship()), "권한이 없습니다.");
    assert.equal(serviceSaveBlock(roles, worship(), worship({ status: "live", startedAt: "2026-10-18T02:00:00.000Z" })), "권한이 없습니다.");
  });

  it("준비만 있으면 순서 수정은 되고 예배 시작은 거부한다", () => {
    const roles: Role[] = ["prepare"];
    assert.equal(serviceSaveBlock(roles, worship(), worship({ title: "수요 예배" })), null);
    assert.equal(serviceSaveBlock(roles, worship(), worship({ status: "ready" })), null);
    assert.equal(
      serviceSaveBlock(roles, worship(), worship({ status: "live", liveIndex: 0, startedAt: "2026-10-18T02:00:00.000Z" })),
      "권한이 없습니다.",
    );
  });

  it("역할 설명에는 출결과 물품을 적지 않는다", () => {
    for (const role of ROLES) {
      assert.equal(role.detail.includes("출결"), false);
      assert.equal(role.detail.includes("물품"), false);
    }
  });

  it("송출만 있으면 순서 편집과 사람 명단을 열지 못한다", () => {
    const roles: Role[] = ["output"];
    assert.equal(canOpenPath(roles, "/services/service-1/output"), true);
    assert.equal(canOpenPath(roles, "/services/service-1/slides"), true);
    assert.equal(canOpenPath(roles, "/services/service-1"), false);
    assert.equal(canOpenPath(roles, "/people"), false);
    assert.equal(can(roles, "mutate.prepare"), false);
    assert.equal(can(roles, "mutate.directory"), false);
  });

  it("슬라이드 리모컨(/remote)은 진행 역할 없이도 연다", () => {
    assert.equal(canOpenPath(["view"] satisfies Role[], "/remote"), true);
    assert.equal(canOpenPath(["output"], "/remote"), true);
    assert.equal(canOpenPath(["prepare"], "/remote"), true);
    assert.equal(canOpenPath([], "/remote"), true);
    assert.equal(can(["view"], "screen.live"), false);
  });

  it("프레젠터(/presenter)는 진행 역할만 연다", () => {
    assert.equal(canOpenPath(["run"] satisfies Role[], "/presenter"), true);
    assert.equal(canOpenPath(["run"], "/presenter/"), true);
    assert.equal(canOpenPath(["view"], "/presenter"), false);
    assert.equal(canOpenPath(["output"], "/presenter"), false);
    assert.equal(canOpenPath(["prepare"], "/presenter"), false);
  });

  it("제거된 성도·커뮤니티·기도함 경로는 역할과 무관하게 막는다", () => {
    assert.equal(canOpenPath(["view"] satisfies Role[], "/member"), false);
    assert.equal(canOpenPath(["admin"], "/member"), false);
    assert.equal(canOpenPath(["admin"], "/community"), false);
    assert.equal(canOpenPath(["admin"], "/prayers"), false);
  });
});

describe("이메일 계정", () => {
  it("처음 계정은 모든 역할을 받고, 두 역할 계정과 마지막 설정·계정을 지킨다", () => {
    assert.equal(readAccounts().length, 0);
    const first = createFirstAccount(" Pastor@Grace.Church ", "예배비밀번호12");
    assert.deepEqual(first.roles, ALL_ROLES);
    assert.equal(first.email, "pastor@grace.church");
    assert.equal(first.passwordHash.includes("예배비밀번호12"), false);
    assert.equal(first.passwordHash.startsWith("scrypt$"), true);
    assert.equal(verifyPassword("예배비밀번호12", first.passwordHash), true);
    assert.equal(verifyPassword("다른비밀번호", first.passwordHash), false);
    const stored = fs.readFileSync(accountsFile(), "utf8");
    assert.equal(stored.includes("예배비밀번호12"), false);
    assert.equal(path.basename(accountsFile()), "accounts.json");
    assert.equal(fs.existsSync(path.join(directory, "church.json")), false);

    const second = addAccount("media@grace.church", "송출비밀번호12", ["view", "output"]);
    assert.deepEqual(second.roles, ["view", "output"]);
    assert.equal(can(second.roles, "mutate.output"), true);
    assert.equal(can(second.roles, "mutate.prepare"), false);
    assert.equal(can(second.roles, "mutate.directory"), false);

    const accounts = readAccounts();
    assert.equal(roleChangeError(accounts, first.id, ["view", "prepare"]), "마지막 설정·계정 역할은 뺄 수 없습니다.");
    assert.equal(deleteAccountError(accounts, first.id), "마지막 설정·계정 계정은 삭제할 수 없습니다.");
    assert.throws(() => updateAccount(first.id, { email: first.email, roles: ["prepare"] }), /마지막 설정·계정 역할/);
    assert.throws(() => deleteAccount(first.id), /마지막 설정·계정 계정/);
    assert.equal(deleteAccountError(accounts, second.id), null);
    deleteAccount(second.id);
    assert.equal(readAccounts().some((account) => account.id === second.id), false);

    const replacement = addAccount("office@grace.church", "계정비밀번호12", ["admin", "view"]);
    assert.equal(roleChangeError(readAccounts(), first.id, ["view"]), null);
    updateAccount(first.id, { email: first.email, roles: ["view"] });
    assert.deepEqual(readAccounts().find((account) => account.id === first.id)?.roles, ["view"]);
    assert.equal(deleteAccountError(readAccounts(), replacement.id), "마지막 설정·계정 계정은 삭제할 수 없습니다.");
  });
});
