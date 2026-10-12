"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveLiveProgress } from "@/lib/actions";
import { formatKoreanDate, formatTime } from "@/lib/format";
import type { Person, Service, Song } from "@/lib/types";
import { clampLiveIndex, describeSong, kindLabel, personName } from "@/lib/worship";

export function LiveConsole({
  service,
  people,
  songs,
  churchName,
}: {
  service: Service;
  people: Person[];
  songs: Song[];
  churchName: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(service.status);
  const [index, setIndex] = useState(clampLiveIndex(service.liveIndex, service.items.length));
  const [startedAt, setStartedAt] = useState(service.startedAt);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const indexRef = useRef(index);
  const statusRef = useRef(status);
  indexRef.current = index;
  statusRef.current = status;
  const elapsed = useElapsed(startedAt, status === "live");
  const item = service.items[index];
  const upcoming = service.items[index + 1];

  function go(next: number) {
    const clamped = clampLiveIndex(next, service.items.length);
    setIndex(clamped);
    setConfirming(false);
    if (statusRef.current !== "live") return;
    startTransition(() => {
      void saveLiveProgress(service.id, clamped).catch(() => setError("순서를 저장하지 못했습니다."));
    });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (statusRef.current !== "live") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(indexRef.current + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(indexRef.current - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [service.id, service.items.length]);

  async function start() {
    setError("");
    try {
      await saveLiveProgress(service.id, 0, "live");
      setStatus("live");
      setIndex(0);
      setStartedAt(new Date().toISOString());
    } catch {
      setError("예배를 시작하지 못했습니다.");
    }
  }

  async function finish() {
    setError("");
    try {
      await saveLiveProgress(service.id, index, "done");
      router.push(`/services/${service.id}`);
    } catch {
      setError("예배를 마치지 못했습니다.");
    }
  }

  return (
    <div className="min-h-screen bg-pine text-[#f6f1e6]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm text-[#d9d0c2]">{churchName}</p>
          <p className="truncate font-serif text-xl">
            {service.title} · {formatKoreanDate(service.date)} {formatTime(service.time)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/services/${service.id}/bulletin`} className="btn btn-on-dark btn-small">
            주보
          </Link>
          <Link href={`/services/${service.id}`} className="btn btn-on-dark btn-small">
            순서 편집
          </Link>
          {status === "live" ? (
            confirming ? (
              <button type="button" className="btn btn-wine btn-small" onClick={() => void finish()}>
                마치기 확인
              </button>
            ) : (
              <button type="button" className="btn btn-on-dark btn-small" onClick={() => setConfirming(true)}>
                예배 마치기
              </button>
            )
          ) : null}
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-[68vh] flex-col justify-center px-6 py-12 lg:px-14">
          {service.items.length === 0 ? (
            <div>
              <h1 className="font-serif text-5xl">순서가 없습니다</h1>
              <Link href={`/services/${service.id}`} className="btn btn-light mt-6">
                순서를 만들러 가기
              </Link>
            </div>
          ) : status !== "live" && status !== "done" ? (
            <div>
              <p className="text-sm text-[#d9d0c2]">시작할 준비</p>
              <h1 className="mt-3 font-serif text-5xl">{service.title}</h1>
              <p className="mt-4 text-lg text-[#d9d0c2]">
                {service.place} · 순서 {service.items.length}개
              </p>
              <button type="button" className="btn btn-light mt-8 px-6 py-3 text-base" onClick={() => void start()}>
                예배 시작
              </button>
            </div>
          ) : item ? (
            <div>
              <p className="text-sm text-[#d9d0c2]">
                {status === "done" ? "마친 예배" : "지금"} · {index + 1} / {service.items.length}
                {status === "live" ? ` · ${elapsed}` : ""}
              </p>
              <p className="mt-4 text-sm text-[#d9d0c2]">{kindLabel(item.kind)}</p>
              <h1 className="mt-2 font-serif text-6xl leading-tight">{item.title}</h1>
              {item.scripture ? <p className="mt-5 text-2xl">{item.scripture}</p> : null}
              <p className="mt-4 text-2xl text-[#f3e6cf]">
                {[personName(people, item.personId), describeSong(songs.find((song) => song.id === item.songId))].filter(Boolean).join(" · ") || "다함께"}
              </p>
              {item.note ? <p className="mt-4 max-w-2xl text-lg text-[#d9d0c2]">{item.note}</p> : null}
              {upcoming ? <p className="mt-10 text-[#d9d0c2]">다음 · {upcoming.title}</p> : <p className="mt-10 text-[#d9d0c2]">마지막 순서입니다</p>}
            </div>
          ) : null}
          {error ? <p className="mt-6 text-[#ffd0d4]">{error}</p> : null}
        </section>

        <aside className="border-t border-white/10 px-4 py-5 lg:border-t-0 lg:border-l">
          <h2 className="px-2 text-sm text-[#d9d0c2]">전체 순서</h2>
          <ol className="mt-3 space-y-1">
            {service.items.map((entry, entryIndex) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`flex w-full items-baseline gap-3 rounded-xl px-3 py-2 text-left disabled:opacity-70 ${entryIndex === index ? "bg-white/10" : "hover:bg-white/5"}`}
                  onClick={() => go(entryIndex)}
                  disabled={status !== "live" && status !== "done"}
                >
                  <span className="w-5 text-sm text-[#d9d0c2]">{entryIndex + 1}</span>
                  <span>
                    <span className="block">{entry.title}</span>
                    <span className="block text-sm text-[#d9d0c2]">{personName(people, entry.personId) || kindLabel(entry.kind)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {status === "live" && service.items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 flex justify-center gap-3 bg-gradient-to-t from-pine via-pine/95 to-transparent px-4 py-5">
          <button type="button" className="btn btn-on-dark" onClick={() => go(index - 1)} disabled={index === 0}>
            이전
          </button>
          <button type="button" className="btn btn-light px-8" onClick={() => go(index + 1)} disabled={index >= service.items.length - 1}>
            다음 순서
          </button>
          <span className="self-center text-sm text-[#d9d0c2]">← 이전 · → 다음</span>
        </div>
      ) : null}
    </div>
  );
}

function useElapsed(startedAt: string | null, active: boolean) {
  const [text, setText] = useState("00:00");
  useEffect(() => {
    if (!active || !startedAt) return;
    function tick() {
      const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt!)) / 1000));
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remain = seconds % 60;
      setText(
        hours > 0
          ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`
          : `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`,
      );
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);
  return text;
}
