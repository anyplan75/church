/**
 * 출석 계산 규칙입니다.
 * 데이터베이스에 접속하지 않습니다. 화면과 서버가 같은 규칙을 씁니다.
 */

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
export type CheckMethod = "SELF_QR" | "GROUP_LEADER" | "EXECUTIVE";
export type MemberLifeStatus = "ACTIVE" | "LONG_ABSENT" | "GRADUATED";
export type AttendanceRole = "PASTOR" | "EXECUTIVE" | "CELL_LEADER" | "MEMBER" | "NEWCOMER";

export type AttendanceFact = {
  sessionId: string;
  sessionDate: string;
  status: AttendanceStatus;
};

export type SelfCheckPlan =
  | { kind: "insert"; status: "PRESENT"; checkMethod: "SELF_QR" }
  | { kind: "keep" };

/** 이미 기록이 있으면 덮어쓰지 않습니다. 없을 때만 본인 QR 출석을 넣습니다. */
export function planSelfCheck(existing: { status: AttendanceStatus } | null): SelfCheckPlan {
  if (existing) return { kind: "keep" };
  return { kind: "insert", status: "PRESENT", checkMethod: "SELF_QR" };
}

function compareRecent(left: AttendanceFact, right: AttendanceFact): number {
  if (left.sessionDate !== right.sessionDate) return left.sessionDate < right.sessionDate ? 1 : -1;
  if (left.sessionId === right.sessionId) return 0;
  return left.sessionId < right.sessionId ? 1 : -1;
}

/**
 * 사유 결석은 연속 결석에서 빼기만 하고, 연속을 끊지 않습니다.
 * 기록이 없는 모임은 여기 들어오지 않으므로 세지 않습니다.
 * 졸업 상태는 바꾸지 않습니다.
 */
export function nextMemberStatus(current: MemberLifeStatus, records: readonly AttendanceFact[]): MemberLifeStatus {
  if (current === "GRADUATED") return "GRADUATED";
  const counted = records.filter((row) => row.status !== "EXCUSED").slice().sort(compareRecent);
  if (counted.length === 0) return current;
  const latest = counted[0]?.status;
  if (latest === "PRESENT" || latest === "LATE") {
    return current === "LONG_ABSENT" ? "ACTIVE" : current;
  }
  const streak = counted.slice(0, 3);
  if (streak.length === 3 && streak.every((row) => row.status === "ABSENT")) return "LONG_ABSENT";
  return current;
}

export function checkMethodForMark(role: "PASTOR" | "EXECUTIVE" | "CELL_LEADER"): "EXECUTIVE" | "GROUP_LEADER" {
  if (role === "PASTOR" || role === "EXECUTIVE") return "EXECUTIVE";
  return "GROUP_LEADER";
}

/** 테우리는 자신이 맡은 모들 식구만 고칩니다. 사역자와 임원은 전체를 고칩니다. */
export function canLeaderEditMember(input: {
  role: AttendanceRole;
  leaderGroupIds: readonly string[];
  memberGroupId: string | null;
}): boolean {
  if (input.role === "PASTOR" || input.role === "EXECUTIVE") return true;
  if (input.role !== "CELL_LEADER") return false;
  return input.memberGroupId !== null && input.leaderGroupIds.includes(input.memberGroupId);
}

export type RollPerson = {
  memberId: string;
  name: string;
  currentGroupId: string | null;
};

export function sortMembersForLeader<T extends RollPerson>(people: readonly T[], leaderGroupIds: readonly string[]): T[] {
  return people.slice().sort((left, right) => {
    const leftOwn = left.currentGroupId !== null && leaderGroupIds.includes(left.currentGroupId) ? 0 : 1;
    const rightOwn = right.currentGroupId !== null && leaderGroupIds.includes(right.currentGroupId) ? 0 : 1;
    if (leftOwn !== rightOwn) return leftOwn - rightOwn;
    return left.name.localeCompare(right.name, "ko");
  });
}

export function canSeeAbsenceCard(input: {
  viewerRole: AttendanceRole | null;
  viewerLeaderGroupIds: readonly string[];
  subjectGroupId: string | null;
}): boolean {
  if (input.viewerRole === "PASTOR" || input.viewerRole === "EXECUTIVE") return true;
  if (input.viewerRole !== "CELL_LEADER") return false;
  return input.subjectGroupId !== null && input.viewerLeaderGroupIds.includes(input.subjectGroupId);
}

export type RateBar = {
  key: string;
  label: string;
  attended: number;
  countable: number;
  rate: number;
};

/** 목요일 기준으로 그 주가 속한 ISO 주 번호를 만듭니다. */
export function isoWeekKey(sessionDate: string): string {
  const [yearText, monthText, dayText] = sessionDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const weekYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function monthKey(sessionDate: string): string {
  return sessionDate.slice(0, 7);
}

function yearKey(sessionDate: string): string {
  return sessionDate.slice(0, 4);
}

function rateBars(records: readonly { sessionDate: string; status: AttendanceStatus }[], keyOf: (sessionDate: string) => string): RateBar[] {
  const buckets = new Map<string, { attended: number; countable: number }>();
  for (const row of records) {
    if (row.status === "EXCUSED") continue;
    const key = keyOf(row.sessionDate);
    const current = buckets.get(key) ?? { attended: 0, countable: 0 };
    current.countable += 1;
    if (row.status === "PRESENT" || row.status === "LATE") current.attended += 1;
    buckets.set(key, current);
  }
  return [...buckets.entries()]
    .sort((left, right) => (left[0] < right[0] ? 1 : left[0] > right[0] ? -1 : 0))
    .map(([key, value]) => ({
      key,
      label: key,
      attended: value.attended,
      countable: value.countable,
      rate: value.countable === 0 ? 0 : Math.round((value.attended / value.countable) * 100),
    }));
}

/** 나온 사람(출석·지각)을 세고, 사유 결석은 분모에서 뺍니다. */
export function attendanceRates(records: readonly { sessionDate: string; status: AttendanceStatus }[]): {
  week: RateBar[];
  month: RateBar[];
  year: RateBar[];
} {
  return {
    week: rateBars(records, isoWeekKey),
    month: rateBars(records, monthKey),
    year: rateBars(records, yearKey),
  };
}
