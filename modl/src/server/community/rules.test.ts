import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  denominationsMatch,
  explainJoinBlock,
  groupIdsToArchive,
  normalizePhone,
  planApproval,
} from "@/server/community/rules";

const openJoin = {
  codeFound: true,
  expired: false,
  exhausted: false,
  denominationMatches: true,
  alreadyPending: false,
  alreadyMember: false,
};

describe("가입 조건", () => {
  it("코드와 교단이 맞으면 신청할 수 있습니다", () => {
    assert.equal(explainJoinBlock(openJoin), null);
    assert.equal(denominationsMatch(" 예장통합 ", "예장통합"), true);
  });

  it("코드, 기한, 횟수, 교단, 중복 신청을 각각 막습니다", () => {
    assert.match(explainJoinBlock({ ...openJoin, codeFound: false }) ?? "", /초대 코드/);
    assert.match(explainJoinBlock({ ...openJoin, expired: true }) ?? "", /기한/);
    assert.match(explainJoinBlock({ ...openJoin, exhausted: true }) ?? "", /더 쓸 수 없/);
    assert.match(explainJoinBlock({ ...openJoin, denominationMatches: false }) ?? "", /교단/);
    assert.match(explainJoinBlock({ ...openJoin, alreadyMember: true }) ?? "", /정식 구성원/);
    assert.match(explainJoinBlock({ ...openJoin, alreadyPending: true }) ?? "", /기다리고/);
  });
});

describe("미가입 명부 병합", () => {
  const members = [
    { id: "kept", userId: null, phone: "010-1234-5678" },
    { id: "linked", userId: "user-1", phone: "01012345678" },
    { id: "other", userId: null, phone: "010-0000-0000" },
  ];

  it("숫자만 같아도 계정 없는 한 줄에 붙입니다", () => {
    assert.equal(normalizePhone("010-1234-5678"), "01012345678");
    assert.deepEqual(planApproval(members, "01012345678"), { kind: "merge", memberId: "kept" });
  });

  it("같은 번호가 없으면 새 구성원입니다", () => {
    assert.deepEqual(planApproval(members, "010-9999-8888"), { kind: "create" });
    assert.deepEqual(planApproval(members, ""), { kind: "create" });
  });

  it("계정 없는 같은 번호가 여러 줄이면 함부로 합치지 않습니다", () => {
    const duplicated = [...members, { id: "again", userId: null, phone: "01012345678" }];
    assert.deepEqual(planApproval(duplicated, "010-1234-5678"), { kind: "ambiguous" });
  });

  it("이미 계정이 붙은 줄은 병합 대상이 아닙니다", () => {
    assert.deepEqual(planApproval([{ id: "linked", userId: "user-9", phone: "01011112222" }], "01011112222"), {
      kind: "create",
    });
  });
});

describe("시즌 보관", () => {
  it("다른 해의 진행 중 모들만 보관하고 줄은 지우지 않을 번호를 고릅니다", () => {
    const ids = groupIdsToArchive(
      [
        { id: "old", seasonYear: 2025, isArchived: false },
        { id: "already", seasonYear: 2024, isArchived: true },
        { id: "now", seasonYear: 2026, isArchived: false },
      ],
      2026,
    );
    assert.deepEqual(ids, ["old"]);
  });
});
