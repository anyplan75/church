import type { AttendanceMark, Person } from "./types";
import { can, type Role } from "./roles";

export const ATTENDANCE_CONSENT_TEXT =
  "출석 여부는 종교 생활 정보로 남습니다. 이 확인은 다른 동의와 따로이며, 출결 저장에만 해당합니다.";

export function canMarkPerson(roles: readonly Role[], selfPersonId: string | null, personId: string): boolean {
  if (can(roles, "mutate.attendance.leader")) return true;
  return Boolean(selfPersonId) && selfPersonId === personId;
}

export function canStoreAttendance(person: Pick<Person, "active" | "membership" | "attendanceConsent"> | undefined): boolean {
  return Boolean(person && person.active && person.membership === "member" && person.attendanceConsent === true);
}

export function isAttendanceLeader(roles: readonly Role[]): boolean {
  return can(roles, "mutate.attendance.leader");
}

export function togglePresent(marks: readonly AttendanceMark[], personId: string, week: string): AttendanceMark[] {
  const key = `${personId}:${week}`;
  const exists = marks.some((mark) => `${mark.personId}:${mark.week}` === key && mark.present);
  if (exists) return marks.filter((mark) => `${mark.personId}:${mark.week}` !== key);
  return [...marks, { personId, week, present: true }];
}

export function splitWeekAttendance(people: readonly Person[], marks: readonly AttendanceMark[], week: string) {
  const presentIds = new Set(marks.filter((mark) => mark.week === week && mark.present).map((mark) => mark.personId));
  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, "ko");
  const members = people.filter((person) => person.active && person.membership === "member").slice().sort(byName);
  const recordable = members.filter((person) => person.attendanceConsent);
  return {
    roster: members,
    present: recordable.filter((person) => presentIds.has(person.id)),
    absent: recordable.filter((person) => !presentIds.has(person.id)),
    pendingConsent: members.filter((person) => !person.attendanceConsent),
    unrecorded: people.filter((person) => person.active && person.membership !== "member").slice().sort(byName),
  };
}
