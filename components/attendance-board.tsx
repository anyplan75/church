"use client";

import { useState } from "react";
import { useChurch } from "@/components/church-state";
import { grantAttendanceConsent, revokeAttendanceConsent, toggleAttendance } from "@/lib/attendance-actions";
import { ATTENDANCE_CONSENT_TEXT, canMarkPerson, isAttendanceLeader, splitWeekAttendance } from "@/lib/attendance";
import { listAccounts } from "@/lib/app-db";
import { formatMonthDay } from "@/lib/format";
import { addDays, mondayOf, todayISO } from "@/lib/worship";
import type { Person } from "@/lib/types";

export function AttendanceBoard() {
  const { ready, user, db } = useChurch();
  const [message, setMessage] = useState("");
  if (!ready || !user || !db) return null;

  const selfId = listAccounts().find((account) => account.id === user.id)?.personId ?? null;
  const leader = isAttendanceLeader(user.roles);
  const week = mondayOf(todayISO());
  const end = addDays(week, 6);
  const groups = splitWeekAttendance(db.people, db.attendance, week);
  const allowed = (personId: string) => canMarkPerson(user.roles, selfId, personId);

  async function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    const result = await action();
    setMessage(result.ok ? "" : result.message);
  }

  return (
    <div className="page">
      <p className="text-sm font-semibold text-gold">이번 주</p>
      <h1 className="mt-1 font-serif text-4xl">출결</h1>
      <p className="mt-2 text-muted">
        등록 교인 명단과 이번 주 출석·미출석입니다. 이름을 누르면 출석이 바뀝니다. 교인 본인이나 인도자가 표시합니다.
      </p>
      <p className="mt-4 text-sm text-muted">
        {formatMonthDay(week)} – {formatMonthDay(end)} · 등록 {groups.roster.length}명 · 출석 {groups.present.length} · 미출석 {groups.absent.length}
      </p>
      <p className="mt-1 text-sm text-ink">
        {leader ? "인도자로 들어와 있어 동의한 교인의 이름을 눌러 표시할 수 있습니다." : selfId ? "연결된 교인 본인의 출석만 표시할 수 있습니다." : "출석 표시는 교인 본인이나 인도자만 할 수 있습니다."}
      </p>
      {groups.unrecorded.length > 0 ? (
        <p className="mt-2 text-sm text-muted">방문자와 새신자 {groups.unrecorded.length}명은 출석을 기록하지 않습니다.</p>
      ) : null}
      {message ? <p className="mt-4 text-sm text-wine">{message}</p> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <NameColumn
          title="출석"
          people={groups.present}
          empty="이번 주 출석이 없습니다."
          present
          allowed={allowed}
          onToggle={(id) => run(() => toggleAttendance(id))}
          onRevoke={(id) => run(() => revokeAttendanceConsent(id))}
        />
        <NameColumn
          title="미출석"
          people={groups.absent}
          empty="출결 저장에 동의한 교인 중 미출석이 없습니다."
          allowed={allowed}
          onToggle={(id) => run(() => toggleAttendance(id))}
          onRevoke={(id) => run(() => revokeAttendanceConsent(id))}
        />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-serif text-2xl">출결 저장 동의</h2>
        <p className="mt-2">{ATTENDANCE_CONSENT_TEXT}</p>
        <p className="mt-2 text-sm text-muted">동의하지 않은 교인, 방문자, 새신자는 출석으로 남지 않습니다. 이 동의는 이름·역할 저장이나 다른 확인과 함께 받지 않습니다.</p>
        {groups.pendingConsent.length === 0 ? <p className="mt-4 text-muted">출결 저장에 동의할 교인이 없습니다.</p> : null}
        <div className="mt-4 flex flex-col gap-3">
          {groups.pendingConsent.map((person) => (
            <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
              <div>
                <p className="font-semibold">{person.name}</p>
                <p className="text-sm text-muted">{person.roles.join(" · ") || "교인"} · 동의 전 · 출석을 기록하지 않음</p>
              </div>
              {allowed(person.id) ? (
                <button type="button" className="btn btn-quiet" onClick={() => run(() => grantAttendanceConsent(person.id))}>
                  출결 저장에 동의
                </button>
              ) : (
                <span className="text-sm text-muted">본인 또는 인도자 확인</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function NameColumn({
  title,
  people,
  empty,
  present = false,
  allowed,
  onToggle,
  onRevoke,
}: {
  title: string;
  people: Person[];
  empty: string;
  present?: boolean;
  allowed: (personId: string) => boolean;
  onToggle: (personId: string) => void;
  onRevoke: (personId: string) => void;
}) {
  return (
    <section className="card p-5">
      <h2 className="font-serif text-2xl">{title}</h2>
      {people.length === 0 ? <p className="mt-4 text-muted">{empty}</p> : null}
      <div className="mt-4 flex flex-col gap-2">
        {people.map((person) => {
          const canPress = allowed(person.id);
          return (
            <div key={person.id} className="flex flex-wrap items-center gap-2">
              {canPress ? (
                <button
                  type="button"
                  aria-pressed={present}
                  onClick={() => onToggle(person.id)}
                  className={`rounded-full px-4 py-2 text-left ${present ? "bg-pine-soft font-semibold text-pine" : "border border-line bg-white"}`}
                >
                  {person.name}
                  {person.roles[0] ? <span className="ml-2 text-xs font-normal text-muted">{person.roles.join(" · ")}</span> : null}
                </button>
              ) : (
                <span className="rounded-full border border-line px-4 py-2">
                  {person.name}
                  {person.roles[0] ? <span className="ml-2 text-xs text-muted">{person.roles.join(" · ")}</span> : null}
                </span>
              )}
              {canPress ? (
                <button type="button" className="btn btn-quiet btn-small" onClick={() => onRevoke(person.id)}>
                  동의 철회
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
