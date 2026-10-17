"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useServiceFolder } from "@/components/service-folder";
import { logout } from "@/lib/account-actions";
import { saveLiveCue, saveLiveProgress } from "@/lib/actions";
import { useChurch } from "@/components/church-state";
import { formatKoreanDate, formatTime } from "@/lib/format";
import { kickOperatorLink, publishLinesNow, startOperatorLink } from "@/lib/output-link";
import { currentOutputHost, hostEntry, saveOutputHost } from "@/lib/output-host";
import { rememberLanHost, subscribeLanStatus } from "@/lib/lan-link";
import { buildDesk, type DeskSlide } from "@/lib/slide-show";
import { START_BLOCKED, settingsReady } from "@/lib/simple";
import { clampLiveIndex, nextService, splitServices, todayISO } from "@/lib/worship";
import type { Person, Service, Song } from "@/lib/types";

/** iPhone·iPad: 현재 예배 고르기 + 큰 이전/다음만. */
export function MobileSlideRemote({ serviceId = "" }: { serviceId?: string }) {
  const { ready, user, db } = useChurch();
  const [pickedId, setPickedId] = useState(serviceId);
  const [choosing, setChoosing] = useState(false);
  const [hostDraft, setHostDraft] = useState("");
  const [hostSaved, setHostSaved] = useState(false);
  const [hostError, setHostError] = useState("");
  const [lanStatus, setLanStatus] = useState("idle");
  const [showHost, setShowHost] = useState(false);

  useEffect(() => subscribeLanStatus(setLanStatus), []);

  useEffect(() => {
    if (!db) return;
    const host = currentOutputHost(db.settings.outputHost);
    setHostDraft(host);
    setHostSaved(Boolean(host));
    setShowHost(!host);
  }, [db]);

  useEffect(() => {
    if (serviceId) {
      setPickedId(serviceId);
      setChoosing(false);
    }
  }, [serviceId]);

  if (!ready || !user || !db) return <p className="page text-muted">불러오는 중</p>;

  const today = todayISO();
  const liveOrNext = nextService(db.services, today);
  const { upcoming } = splitServices(db.services, today);
  const activeId = pickedId || (!choosing ? liveOrNext?.id : "") || "";
  const service = db.services.find((item) => item.id === activeId) ?? null;
  const statusLabel =
    lanStatus === "direct"
      ? "송출 연결됨"
      : lanStatus === "connecting"
        ? "송출 연결 중"
        : lanStatus === "error"
          ? "송출 다시 연결 중"
          : hostSaved
            ? "송출 IP 저장됨"
            : "송출 IP 필요";

  function saveHost() {
    setHostError("");
    const entry = hostEntry(hostDraft);
    if (entry.problem === "url") {
      setHostError("웹 주소가 아니라 송출 컴퓨터의 IP만 넣어 주세요.");
      return;
    }
    if (entry.problem === "invalid" || !entry.host) {
      setHostError("이 송출 컴퓨터의 IP만 넣어 주세요. 예: 192.168.0.10");
      return;
    }
    saveOutputHost(entry.host);
    rememberLanHost(entry.host);
    kickOperatorLink();
    setHostSaved(true);
    setShowHost(false);
    setHostDraft(entry.host);
  }

  return (
    <div className="mobile-remote min-h-screen bg-pine text-[#f6f1e6]">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="font-serif text-xl leading-tight">은혜로운 예배 Remote</p>
          <p className="mt-0.5 text-xs text-[#d9d0c2]">
            {db.settings.churchName ? `${db.settings.churchName} · ` : ""}슬라이드 넘기기 · {statusLabel}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-on-dark btn-small" onClick={() => setShowHost((v) => !v)}>
            송출
          </button>
          <form action={logout}>
            <button type="submit" className="btn btn-on-dark btn-small">
              나가기
            </button>
          </form>
        </div>
      </header>

      {showHost ? (
        <section className="space-y-3 border-b border-white/10 px-4 py-4">
          <p className="text-sm text-[#d9d0c2]">송출 Mac/Windows의 IP를 한 번만 넣습니다. 같은 Wi‑Fi, 포트 18765.</p>
          <label className="field">
            <span className="text-[#d9d0c2]">송출 컴퓨터 IP</span>
            <input
              className="input input-touch"
              value={hostDraft}
              onChange={(event) => setHostDraft(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="예: 192.168.0.10"
              maxLength={200}
              aria-label="송출 컴퓨터 IP"
            />
          </label>
          {hostError ? <p className="text-sm text-[#ffd0d4]">{hostError}</p> : null}
          <button type="button" className="btn btn-light btn-touch w-full" onClick={saveHost}>
            저장하고 연결
          </button>
        </section>
      ) : null}

      {service && !choosing ? (
        <RemoteDesk
          service={service}
          people={db.people}
          songs={db.songs}
          canStart={settingsReady(db.settings)}
          onChangeService={() => {
            setChoosing(true);
            setPickedId("");
          }}
        />
      ) : (
        <ServicePicker
          upcoming={upcoming}
          onPick={(id) => {
            setPickedId(id);
            setChoosing(false);
          }}
          empty="넘길 예배가 없습니다. 데스크톱에서 예배를 준비해 주세요."
        />
      )}
    </div>
  );
}

function ServicePicker({
  upcoming,
  onPick,
  empty,
}: {
  upcoming: Service[];
  onPick: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="px-4 py-6">
      <h1 className="font-serif text-3xl">현재 예배</h1>
      <p className="mt-2 text-sm text-[#d9d0c2]">넘길 예배를 고릅니다. 진행 중이면 자동으로 잡습니다.</p>
      {upcoming.length === 0 ? <p className="mt-6 text-[#d9d0c2]">{empty}</p> : null}
      <ul className="mt-5 space-y-3">
        {upcoming.map((service) => (
          <li key={service.id}>
            <button
              type="button"
              className={`w-full rounded-2xl px-4 py-4 text-left ${service.status === "live" ? "bg-white text-pine" : "bg-white/10"}`}
              onClick={() => onPick(service.id)}
            >
              <p className="text-sm opacity-80">
                {formatKoreanDate(service.date)} · {formatTime(service.time)}
                {service.status === "live" ? " · 진행 중" : ""}
              </p>
              <p className="mt-1 font-serif text-2xl">{service.title}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RemoteDesk({
  service,
  people,
  songs,
  canStart,
  onChangeService,
}: {
  service: Service;
  people: Person[];
  songs: Song[];
  canStart: boolean;
  onChangeService: () => void;
}) {
  const [status, setStatus] = useState(service.status);
  const [index, setIndex] = useState(clampLiveIndex(service.liveIndex, service.items.length));
  const [slide, setSlide] = useState(service.liveSlide ?? 0);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const folder = useServiceFolder(service, songs);

  useEffect(() => {
    setStatus(service.status);
    setIndex(clampLiveIndex(service.liveIndex, service.items.length));
    setSlide(service.liveSlide ?? 0);
  }, [service.id, service.status, service.liveIndex, service.liveSlide, service.items.length]);

  useEffect(() => startOperatorLink(service.id), [service.id]);

  const local = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [id, fill] of Object.entries(folder.fills)) {
      if (fill.slides.length > 0) map[id] = fill.slides;
    }
    return map;
  }, [folder.fills]);

  const desk = useMemo(() => buildDesk(service, people, songs, local), [service, people, songs, local]);
  const current =
    desk.slides.find((item) => item.groupIndex === index && item.inGroup === slide) ??
    desk.slides.find((item) => item.groupIndex === index) ??
    desk.slides[0];
  const next = current ? desk.slides[current.flat + 1] : undefined;
  const prev = current && current.flat > 0 ? desk.slides[current.flat - 1] : undefined;
  const cueKey = current ? `${current.groupIndex}:${current.inGroup}:${current.lines.join("\n")}` : "";

  const go = useCallback(
    (groupIndex: number, inGroup: number, lines: string[] = []) => {
      const clamped = clampLiveIndex(groupIndex, service.items.length);
      publishLinesNow(service.id, lines);
      setIndex(clamped);
      setSlide(inGroup);
      startTransition(() => {
        void saveLiveCue(service.id, clamped, inGroup, lines).then((result) => {
          if (!result.ok) setError(result.message);
        });
      });
    },
    [service.id, service.items.length],
  );

  useEffect(() => {
    if (!current || !folder.loaded || status !== "live") return;
    go(current.groupIndex, current.inGroup, current.lines);
    // cueKey로 현재 슬라이드가 바뀔 때만 맞춥니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cueKey, folder.loaded, status]);

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
  }

  function goPrev() {
    if (!prev) return;
    go(prev.groupIndex, prev.inGroup, prev.lines);
  }

  function goNext() {
    if (!next) return;
    go(next.groupIndex, next.inGroup, next.lines);
  }

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col px-4 pb-36 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-[#d9d0c2]">
            {formatKoreanDate(service.date)} · {formatTime(service.time)}
          </p>
          <h1 className="truncate font-serif text-2xl">{service.title}</h1>
        </div>
        <button type="button" className="btn btn-on-dark btn-small" onClick={onChangeService}>
          예배 바꾸기
        </button>
      </div>

      {status !== "live" && status !== "done" && service.items.length > 0 ? (
        <div className="mt-6">
          <button type="button" className="btn btn-light btn-touch w-full" onClick={() => void start()} disabled={!canStart}>
            예배 시작
          </button>
          {!canStart ? <p className="mt-3 text-sm text-[#ffd0d4]">{START_BLOCKED}</p> : null}
        </div>
      ) : null}

      {status === "live" && current ? (
        <>
          <Preview label="현재" slide={current} large />
          {next ? <Preview label="다음" slide={next} /> : <p className="mt-4 text-sm text-[#d9d0c2]">다음 슬라이드가 없습니다</p>}
          <p className="mt-4 text-center text-sm text-[#d9d0c2]">
            {current.flat + 1} / {desk.slides.length}
          </p>
        </>
      ) : null}

      {service.items.length === 0 ? <p className="mt-8 text-[#d9d0c2]">순서가 없습니다. 데스크톱에서 순서를 넣어 주세요.</p> : null}
      {error ? <p className="mt-3 text-[#ffd0d4]">{error}</p> : null}
      {status === "done" ? <p className="mt-8 text-[#d9d0c2]">마친 예배입니다. 예배 바꾸기로 다른 예배를 고르세요.</p> : null}

      {status === "live" ? (
        <div className="mobile-remote-bar" role="toolbar" aria-label="슬라이드 넘기기">
          <button type="button" className="btn btn-on-dark mobile-remote-btn" onClick={goPrev} disabled={!prev}>
            이전
          </button>
          <button type="button" className="btn btn-light mobile-remote-btn" onClick={goNext} disabled={!next}>
            다음
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Preview({ slide, label, large = false }: { slide: DeskSlide; label: string; large?: boolean }) {
  return (
    <article className={`mt-5 ${large ? "" : "opacity-90"}`}>
      <p className="text-xs uppercase tracking-wide text-[#d9d0c2]">{label}</p>
      <div className={`mt-2 rounded-2xl bg-[#10241f] text-center ${large ? "min-h-40 p-5" : "p-4"}`}>
        <p className="text-sm text-[#d9d0c2]">{slide.kicker}</p>
        {slide.lines.length > 0 ? (
          <>
            <p className={`mt-2 font-serif leading-snug ${large ? "text-3xl" : "text-2xl"}`}>{slide.lines[0]}</p>
            {slide.lines[1] ? <p className={`mt-2 font-serif leading-snug ${large ? "text-3xl" : "text-2xl"}`}>{slide.lines[1]}</p> : null}
          </>
        ) : (
          <h2 className={`mt-2 font-serif leading-tight ${large ? "text-3xl" : "text-2xl"}`}>{slide.heading}</h2>
        )}
      </div>
    </article>
  );
}
