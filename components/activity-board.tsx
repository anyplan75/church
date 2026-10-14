"use client";

import { useEffect, useState } from "react";
import { readActivityBoards } from "@/lib/app-db";
import { useChurch } from "@/components/church-state";
import type { ActivityEntry } from "@/lib/types";

type Board = { churchId: string; churchName: string; entries: ActivityEntry[] };

export function ActivityBoard() {
  const { ready, user } = useChurch();
  const [boards, setBoards] = useState<Board[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready || !user) return;
    let stop = false;
    readActivityBoards()
      .then((next) => {
        if (!stop) setBoards(next);
      })
      .catch(() => {
        if (!stop) setMessage("기록을 불러오지 못했습니다.");
      });
    return () => {
      stop = true;
    };
  }, [ready, user]);

  if (!ready || !user) return null;
  const scope = user.kind === "platform" ? "모든 교회" : "이 교회";

  return (
    <div className="page">
      <p className="text-sm font-semibold text-gold">작업 기록</p>
      <h1 className="mt-1 font-serif text-4xl">누가 무엇을 했는지</h1>
      <p className="mt-2 text-muted">
        {user.email} · {scope} 기록입니다. 가사와 성경 본문은 적지 않습니다.
      </p>
      {message ? <p className="mt-4 text-sm text-wine">{message}</p> : null}
      <div className="mt-6 space-y-4">
        {boards.length === 0 ? <p className="text-muted">아직 기록이 없습니다.</p> : null}
        {boards.map((board) => (
          <section key={board.churchId} className="card p-5">
            <h2 className="font-serif text-2xl">{board.churchName}</h2>
            {board.entries.length === 0 ? <p className="mt-3 text-muted">이 교회 기록이 없습니다.</p> : null}
            <ol className="mt-3 divide-y divide-line">
              {board.entries.map((entry) => (
                <li key={entry.id} className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <time className="text-sm text-muted">{formatWhen(entry.at)}</time>
                  <p>
                    <span className="font-semibold">{entry.email}</span>
                    <span className="text-muted"> · {entry.action}</span>
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
