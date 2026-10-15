"use client";

import Link from "next/link";
import { useState } from "react";
import { useChurch } from "@/components/church-state";
import { saveLiveProgress } from "@/lib/actions";
import { formatKoreanDate, formatMonthDay, formatTime } from "@/lib/format";
import { can } from "@/lib/roles";
import { START_BLOCKED, settingsReady } from "@/lib/simple";
import { addDays, sundayOf, todayISO, weekServices } from "@/lib/worship";

export default function WeekPage() {
  const { ready, user, db } = useChurch();
  const [message, setMessage] = useState("");
  if (!ready || !user || !db) return null;
  const today = todayISO();
  const start = sundayOf(today);
  const services = weekServices(db.services, today);
  const unlocked = settingsReady(db.settings);
  const canRun = can(user.roles, "mutate.run");

  async function begin(id: string) {
    setMessage("");
    const result = await saveLiveProgress(id, 0, "live");
    if (!result.ok) setMessage(result.message);
  }

  return (
    <div className="page">
      <h1 className="font-serif text-4xl">이번 주</h1>
      <p className="mt-2 text-muted">
        {formatMonthDay(start)} – {formatMonthDay(addDays(start, 6))} · 주일부터 토요일까지
      </p>
      {unlocked ? null : (
        <p className="mt-4 text-sm text-wine">
          {START_BLOCKED} <Link href="/settings">설정으로 가기</Link>
        </p>
      )}
      {message ? <p className="mt-4 text-sm text-wine">{message}</p> : null}
      <div className="mt-6 space-y-3">
        {services.length === 0 ? <p className="text-muted">이번 주 예배가 없습니다. 주보에서 읽어 주세요.</p> : null}
        {services.map((service) => (
          <article key={service.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">
                {service.title} · {formatKoreanDate(service.date)} {formatTime(service.time)}
              </p>
              <p className="text-sm text-muted">{service.place}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canRun && service.status !== "live" && service.status !== "done" ? (
                <button type="button" className="btn btn-primary btn-small" disabled={!unlocked} onClick={() => void begin(service.id)}>
                  예배 시작
                </button>
              ) : null}
              {service.status === "live" ? (
                <Link href={`/services/${service.id}/live`} className="btn btn-primary btn-small">
                  진행 화면
                </Link>
              ) : (
                <Link href={`/services/${service.id}/live`} className="btn btn-quiet btn-small">
                  예배 화면
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
