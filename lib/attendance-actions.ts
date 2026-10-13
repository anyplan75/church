import { canMarkPerson, canStoreAttendance, togglePresent } from "./attendance";
import { currentUser, listAccounts, updateDb } from "./app-db";
import { can } from "./roles";
import { mondayOf, todayISO } from "./worship";

export async function toggleAttendance(personId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = currentUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  if (!can(user.roles, "screen.attendance")) return { ok: false, message: "권한이 없습니다." };
  const selfId = listAccounts().find((account) => account.id === user.id)?.personId ?? null;
  if (!canMarkPerson(user.roles, selfId, personId)) return { ok: false, message: "교인 본인이나 인도자만 표시할 수 있습니다." };

  let changed = false;
  let blocked = false;
  updateDb((db) => {
    const person = db.people.find((item) => item.id === personId);
    if (!person || !person.active || person.membership !== "member") {
      blocked = true;
      return;
    }
    if (!canStoreAttendance(person)) {
      blocked = true;
      return;
    }
    db.attendance = togglePresent(db.attendance, personId, mondayOf(todayISO()));
    changed = true;
  });
  if (!changed) {
    return { ok: false, message: blocked ? "출결 저장에 동의한 교인만 기록할 수 있습니다." : "등록된 교인이 아닙니다." };
  }
  return { ok: true };
}

export async function grantAttendanceConsent(personId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const allowed = await attendanceActor(personId);
  if (!allowed.ok) return allowed;
  let changed = false;
  updateDb((db) => {
    const person = db.people.find((item) => item.id === personId && item.active && item.membership === "member");
    if (!person) return;
    person.attendanceConsent = true;
    changed = true;
  });
  if (!changed) return { ok: false, message: "방문자와 새신자, 동의 대상이 아닌 사람은 출석을 기록하지 않습니다." };
  return { ok: true };
}

export async function revokeAttendanceConsent(personId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const allowed = await attendanceActor(personId);
  if (!allowed.ok) return allowed;
  updateDb((db) => {
    const person = db.people.find((item) => item.id === personId);
    if (person) person.attendanceConsent = false;
    db.attendance = db.attendance.filter((mark) => mark.personId !== personId);
  });
  return { ok: true };
}

async function attendanceActor(personId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = currentUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };
  if (!can(user.roles, "screen.attendance")) return { ok: false, message: "권한이 없습니다." };
  const selfId = listAccounts().find((account) => account.id === user.id)?.personId ?? null;
  if (!canMarkPerson(user.roles, selfId, personId)) return { ok: false, message: "교인 본인이나 인도자만 표시할 수 있습니다." };
  return { ok: true };
}
