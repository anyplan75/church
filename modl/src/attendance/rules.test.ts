import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceRates,
  canLeaderEditMember,
  canSeeAbsenceCard,
  checkMethodForMark,
  isoWeekKey,
  nextMemberStatus,
  planSelfCheck,
  sortMembersForLeader,
  type AttendanceFact,
} from "@/attendance/rules";

const absent = (sessionDate: string, sessionId: string): AttendanceFact => ({
  sessionId,
  sessionDate,
  status: "ABSENT",
});

describe("본인 QR 체크인", () => {
  it("기록이 없으면 출석과 본인 QR 로 넣습니다", () => {
    assert.deepEqual(planSelfCheck(null), { kind: "insert", status: "PRESENT", checkMethod: "SELF_QR" });
  });

  it("한 모임에 이미 기록이 있으면 상태와 방법을 덮지 않습니다", () => {
    assert.deepEqual(planSelfCheck({ status: "ABSENT" }), { kind: "keep" });
    assert.deepEqual(planSelfCheck({ status: "LATE" }), { kind: "keep" });
  });
});

describe("연속 결석 세 번", () => {
  it("최근 기록 세 개가 모두 결석이면 보고픈 괸당이 됩니다", () => {
    const next = nextMemberStatus("ACTIVE", [
      absent("2026-10-01", "a"),
      absent("2026-10-08", "b"),
      absent("2026-10-15", "c"),
    ]);
    assert.equal(next, "LONG_ABSENT");
  });

  it("사유 결석은 연속에서 빼기만 하고 끊지 않습니다", () => {
    const next = nextMemberStatus("ACTIVE", [
      absent("2026-10-01", "a"),
      { sessionId: "b", sessionDate: "2026-10-08", status: "EXCUSED" },
      absent("2026-10-15", "c"),
      absent("2026-10-22", "d"),
    ]);
    assert.equal(next, "LONG_ABSENT");
  });

  it("사유 결석을 빼면 두 번뿐이면 바꾸지 않습니다", () => {
    const next = nextMemberStatus("ACTIVE", [
      absent("2026-10-01", "a"),
      { sessionId: "b", sessionDate: "2026-10-08", status: "EXCUSED" },
      absent("2026-10-15", "c"),
    ]);
    assert.equal(next, "ACTIVE");
  });

  it("기록이 없는 모임은 세지 않습니다", () => {
    const next = nextMemberStatus("ACTIVE", [absent("2026-10-01", "a"), absent("2026-10-15", "c")]);
    assert.equal(next, "ACTIVE");
  });

  it("다시 출석하거나 지각하면 활동으로 되돌립니다", () => {
    const returned = nextMemberStatus("LONG_ABSENT", [
      absent("2026-10-01", "a"),
      absent("2026-10-08", "b"),
      absent("2026-10-15", "c"),
      { sessionId: "d", sessionDate: "2026-10-22", status: "PRESENT" },
    ]);
    const late = nextMemberStatus("LONG_ABSENT", [{ sessionId: "e", sessionDate: "2026-10-29", status: "LATE" }]);
    assert.equal(returned, "ACTIVE");
    assert.equal(late, "ACTIVE");
  });

  it("졸업 상태는 결석이 이어져도 바꾸지 않습니다", () => {
    const next = nextMemberStatus("GRADUATED", [
      absent("2026-10-01", "a"),
      absent("2026-10-08", "b"),
      absent("2026-10-15", "c"),
    ]);
    assert.equal(next, "GRADUATED");
  });

  it("같은 날이면 모임 번호가 늦은 기록을 최근으로 봅니다", () => {
    const next = nextMemberStatus("LONG_ABSENT", [
      absent("2026-10-01", "a"),
      { sessionId: "m", sessionDate: "2026-10-08", status: "PRESENT" },
      absent("2026-10-08", "z"),
    ]);
    assert.equal(next, "LONG_ABSENT");
  });
});

describe("테우리 범위", () => {
  it("사역자와 임원은 다른 모들도 고치고 확인 방법은 임원입니다", () => {
    for (const role of ["PASTOR", "EXECUTIVE"] as const) {
      assert.equal(
        canLeaderEditMember({ role, leaderGroupIds: [], memberGroupId: "other" }),
        true,
      );
      assert.equal(checkMethodForMark(role), "EXECUTIVE");
    }
  });

  it("테우리는 맡은 모들만 고치고 확인 방법은 테우리입니다", () => {
    assert.equal(
      canLeaderEditMember({ role: "CELL_LEADER", leaderGroupIds: ["own"], memberGroupId: "own" }),
      true,
    );
    assert.equal(
      canLeaderEditMember({ role: "CELL_LEADER", leaderGroupIds: ["own"], memberGroupId: "other" }),
      false,
    );
    assert.equal(
      canLeaderEditMember({ role: "CELL_LEADER", leaderGroupIds: ["own"], memberGroupId: null }),
      false,
    );
    assert.equal(checkMethodForMark("CELL_LEADER"), "GROUP_LEADER");
  });

  it("구성원과 새가족은 다른 사람 출석을 고치지 못합니다", () => {
    for (const role of ["MEMBER", "NEWCOMER"] as const) {
      assert.equal(canLeaderEditMember({ role, leaderGroupIds: [], memberGroupId: "own" }), false);
    }
  });

  it("맡은 모들 식구를 목록 맨 위에 모읍니다", () => {
    const sorted = sortMembersForLeader(
      [
        { memberId: "1", name: "가나", currentGroupId: "other" },
        { memberId: "2", name: "다라", currentGroupId: "own" },
        { memberId: "3", name: "마바", currentGroupId: "own" },
      ],
      ["own"],
    );
    assert.deepEqual(
      sorted.map((person) => person.memberId),
      ["2", "3", "1"],
    );
  });

  it("보고픈 괸당 카드는 사역자, 임원, 그 사람의 테우리만 봅니다", () => {
    assert.equal(canSeeAbsenceCard({ viewerRole: "PASTOR", viewerLeaderGroupIds: [], subjectGroupId: "g" }), true);
    assert.equal(canSeeAbsenceCard({ viewerRole: "EXECUTIVE", viewerLeaderGroupIds: [], subjectGroupId: null }), true);
    assert.equal(
      canSeeAbsenceCard({ viewerRole: "CELL_LEADER", viewerLeaderGroupIds: ["g"], subjectGroupId: "g" }),
      true,
    );
    assert.equal(
      canSeeAbsenceCard({ viewerRole: "CELL_LEADER", viewerLeaderGroupIds: ["g"], subjectGroupId: "other" }),
      false,
    );
    assert.equal(canSeeAbsenceCard({ viewerRole: "MEMBER", viewerLeaderGroupIds: [], subjectGroupId: "g" }), false);
    assert.equal(canSeeAbsenceCard({ viewerRole: "NEWCOMER", viewerLeaderGroupIds: [], subjectGroupId: "g" }), false);
    assert.equal(canSeeAbsenceCard({ viewerRole: null, viewerLeaderGroupIds: [], subjectGroupId: "g" }), false);
  });
});

describe("출석률", () => {
  it("사유 결석은 분모에서 빼고 주간 월간 연간으로 나눕니다", () => {
    assert.equal(isoWeekKey("2026-10-05"), isoWeekKey("2026-10-11"));
    assert.notEqual(isoWeekKey("2026-10-05"), isoWeekKey("2026-10-12"));
    const rates = attendanceRates([
      { sessionDate: "2026-10-05", status: "PRESENT" },
      { sessionDate: "2026-10-05", status: "LATE" },
      { sessionDate: "2026-10-05", status: "ABSENT" },
      { sessionDate: "2026-10-05", status: "EXCUSED" },
      { sessionDate: "2026-11-02", status: "ABSENT" },
    ]);
    const october = rates.month.find((bar) => bar.key === "2026-10");
    assert.equal(october?.attended, 2);
    assert.equal(october?.countable, 3);
    assert.equal(october?.rate, 67);
    assert.equal(rates.week.length, 2);
    assert.equal(rates.year.find((bar) => bar.key === "2026")?.countable, 4);
  });
});
