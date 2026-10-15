"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CopyrightNotice } from "@/components/copyright-notice";
import { OutputLinks } from "@/components/output-links";
import { SlideDesk } from "@/components/slide-desk";
import { saveLiveProgress } from "@/lib/actions";
import { formatKoreanDate, formatTime } from "@/lib/format";
import type { Person, Service, Song } from "@/lib/types";
import { START_BLOCKED } from "@/lib/simple";
import { clampLiveIndex } from "@/lib/worship";

export function LiveConsole({
  service,
  people,
  songs,
  churchName,
  access,
  canStart = true,
}: {
  service: Service;
  people: Person[];
  songs: Song[];
  churchName: string;
  access: { output: boolean; bulletin: boolean; editor: boolean };
  canStart?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(service.status);
  const [index, setIndex] = useState(clampLiveIndex(service.liveIndex, service.items.length));
  const [slide, setSlide] = useState(service.liveSlide ?? 0);
  const [startedAt, setStartedAt] = useState(service.startedAt);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const statusRef = useRef(status);
  statusRef.current = status;
  const elapsed = useElapsed(startedAt, status === "live");

  function go(groupIndex: number, inGroup: number) {
    const clamped = clampLiveIndex(groupIndex, service.items.length);
    setIndex(clamped);
    setSlide(inGroup);
    setConfirming(false);
    if (statusRef.current !== "live") return;
    startTransition(() => {
      void saveLiveProgress(service.id, clamped, undefined, inGroup).then((result) => {
        if (!result.ok) setError(result.message);
      });
    });
  }

  async function start() {
    setError("");
    const result = await saveLiveProgress(service.id, 0, "live");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStatus("live");
    setIndex(0);
    setSlide(0);
    setStartedAt(new Date().toISOString());
  }

  async function finish() {
    setError("");
    const result = await saveLiveProgress(service.id, index, "done");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(`/services/${service.id}`);
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
          {access.output ? <OutputLinks id={service.id} className="btn btn-on-dark btn-small" /> : null}
          {access.bulletin ? (
            <Link href={`/services/${service.id}/bulletin`} className="btn btn-on-dark btn-small">
              주보
            </Link>
          ) : null}
          {access.editor ? (
            <Link href={`/services/${service.id}`} className="btn btn-on-dark btn-small">
              순서 편집
            </Link>
          ) : null}
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

      <div className="px-5 pt-4">
        <div className="text-[#f6f1e6]">
          <CopyrightNotice />
        </div>
        {status !== "live" && status !== "done" && service.items.length > 0 ? (
          <button type="button" className="btn btn-light mt-4" onClick={() => void start()} disabled={!canStart}>
            예배 시작
          </button>
        ) : null}
        {status !== "live" && status !== "done" && !canStart ? <p className="mt-3 text-sm text-[#ffd0d4]">{START_BLOCKED}</p> : null}
        {status === "live" ? <p className="mt-3 text-sm text-[#d9d0c2]">진행 {elapsed}</p> : null}
        {error ? <p className="mt-3 text-[#ffd0d4]">{error}</p> : null}
      </div>
      {service.items.length === 0 ? (
        <div className="px-6 py-16">
          <h1 className="font-serif text-5xl">순서가 없습니다</h1>
        </div>
      ) : (
        <SlideDesk service={service} people={people} songs={songs} groupIndex={index} inGroup={slide} onJump={go} />
      )}
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
