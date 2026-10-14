import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ATTENDANCE_CONSENT_TEXT, canMarkPerson, canStoreAttendance, splitWeekAttendance, togglePresent } from "./attendance.ts";
import { normalizeDb } from "./db-shape.ts";
import { canOpenPath, type Role } from "./roles.ts";
import type { AttendanceMark, Person } from "./types.ts";

function person(partial: Partial<Person> & Pick<Person, "id" | "name">): Person {
  return {
    roles: [],
    phone: "",
    active: true,
    membership: "member",
    attendanceConsent: false,
    ...partial,
  };
}

const week = "2026-10-12";

describe("출결", () => {
  it("동의한 교인만 이번 주 출석과 미출석에 남고, 동의는 출석 표시와 분리된다", () => {
    const people = [
      person({ id: "a", name: "김은혜", attendanceConsent: true }),
      person({ id: "b", name: "박요한", attendanceConsent: true }),
      person({ id: "c", name: "이성실" }),
      person({ id: "d", name: "윤나그네", membership: "visitor", attendanceConsent: true }),
      person({ id: "e", name: "한새빛", membership: "newcomer", attendanceConsent: true }),
    ];
    const marks = togglePresent([], "a", week);
    const view = splitWeekAttendance(people, marks, week);
    assert.deepEqual(view.present.map((item) => item.id), ["a"]);
    assert.deepEqual(view.absent.map((item) => item.id), ["b"]);
    assert.deepEqual(view.pendingConsent.map((item) => item.id), ["c"]);
    assert.deepEqual(view.roster.map((item) => item.id), ["a", "b", "c"]);
    assert.deepEqual(view.unrecorded.map((item) => item.name), ["윤나그네", "한새빛"]);
    assert.equal(canStoreAttendance(people[0]), true);
    assert.equal(canStoreAttendance(people[2]), false);
    assert.equal(canStoreAttendance(people[3]), false);
    assert.equal(canStoreAttendance(people[4]), false);
    assert.equal(marks.some((mark) => mark.personId === "c"), false);
  });

  it("본인이거나 인도자만 표시하고, 동의 문구는 종교 생활 정보를 따로 알린다", () => {
    const leader: Role[] = ["prepare"];
    const member: Role[] = ["view"];
    assert.equal(canMarkPerson(leader, null, "a"), true);
    assert.equal(canMarkPerson(member, "a", "a"), true);
    assert.equal(canMarkPerson(member, "a", "b"), false);
    assert.equal(canMarkPerson(member, null, "a"), false);
    assert.equal(canOpenPath(member, "/attendance"), true);
    assert.match(ATTENDANCE_CONSENT_TEXT, /종교 생활 정보/);
    assert.match(ATTENDANCE_CONSENT_TEXT, /따로/);
  });

  it("동의하지 않은 사람, 방문자, 새신자와 감시 항목은 저장 모양에 남지 않는다", () => {
    const photo = `data:image/jpeg;base64,${"a".repeat(40)}`;
    const db = normalizeDb({
      people: [
        { ...person({ id: "a", name: "김은혜", attendanceConsent: true }), faceId: "abc" },
        person({ id: "b", name: "이성실" }),
        person({ id: "c", name: "윤나그네", membership: "visitor", attendanceConsent: true }),
        person({ id: "d", name: "한새빛", membership: "newcomer" }),
      ],
      attendance: [
        { personId: "a", week, present: true },
        { personId: "b", week, present: true },
        { personId: "c", week, present: true },
        { personId: "d", week, present: true },
      ] as AttendanceMark[],
      supplies: [{ id: "item-1", departmentId: "dept-worship", name: "접이식 의자", photo, status: "have" }],
      faceTemplates: ["abc"],
      watchlist: ["신천지"],
      entryAlerts: [{ kind: "추수꾼" }],
    } as never);
    assert.deepEqual(db.attendance.map((mark) => mark.personId), ["a"]);
    assert.equal(db.people.find((item) => item.id === "c")?.attendanceConsent, false);
    assert.equal(db.people.find((item) => item.id === "b")?.attendanceConsent, false);
    const json = JSON.stringify(db);
    assert.equal(json.includes("faceId"), false);
    assert.equal(json.includes("faceTemplates"), false);
    assert.equal(json.includes("watchlist"), false);
    assert.equal(json.includes("entryAlert"), false);
    assert.equal(json.includes("신천지"), false);
    assert.equal(json.includes("추수꾼"), false);
  });

  it("목록이 없으면 예시 예배와 사람을 채우지 않는다", () => {
    const db = normalizeDb({ settings: { churchName: "서귀포제일교회", backgroundColor: "#1b3a32", backgroundFile: null, overlay: "bottom" } });
    assert.equal(db.settings.churchName, "서귀포제일교회");
    assert.deepEqual(db.services, []);
    assert.deepEqual(db.people, []);
    assert.deepEqual(db.songs, []);
    assert.deepEqual(db.departments, []);
    assert.equal(JSON.stringify(db).includes("은혜교회"), false);
  });
});
