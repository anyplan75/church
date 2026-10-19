"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveConsole } from "@/components/live-console";
import { useChurch, useClientQuery } from "@/components/church-state";
import { StatusBadge } from "@/components/status-badge";
import { formatKoreanDate, formatTime } from "@/lib/format";
import { isMobileOperatorApp } from "@/lib/mobile-app";
import { MobileSlideRemote } from "@/components/mobile-slide-remote";
import { presenterHref, presenterServiceChoices, resolvePresenterServiceId } from "@/lib/presenter";
import { can } from "@/lib/roles";
import { settingsReady } from "@/lib/simple";
import { todayISO } from "@/lib/worship";
import type { Service } from "@/lib/types";

/** 데스크톱 조작: 예배 고르기 → ProPresenter식 슬라이드 조작. */
export function PresenterConsole() {
  const { ready, user, db } = useChurch();
  const query = useClientQuery();
  const [pickedId, setPickedId] = useState("");

  useEffect(() => {
    const fromUrl = String(query.service ?? "").trim();
    if (fromUrl) setPickedId(fromUrl);
  }, [query.service]);

  const selectService = useCallback((id: string) => {
    setPickedId(id);
    const href = presenterHref(id);
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new Event("church-nav"));
  }, []);

  const clearService = useCallback(() => {
    setPickedId("");
    window.history.replaceState(null, "", presenterHref());
    window.dispatchEvent(new Event("church-nav"));
  }, []);

  if (!ready || !user || !db) return null;
  if (isMobileOperatorApp()) return <MobileSlideRemote serviceId={pickedId} />;

  if (!can(user.roles, "screen.live")) {
    return (
      <div className="page">
        <h1 className="font-serif text-4xl">프레젠터</h1>
        <p className="mt-3 text-muted">진행 역할이 있는 계정만 슬라이드를 넘길 수 있습니다.</p>
      </div>
    );
  }

  const today = todayISO();
  const choices = presenterServiceChoices(db.services, today);
  const activeId = resolvePresenterServiceId(db.services, pickedId, today);
  const service = pickedId ? db.services.find((item) => item.id === pickedId) : null;

  if (service) {
    return (
      <LiveConsole
        service={service}
        people={db.people}
        songs={db.songs}
        churchName={db.settings.churchName}
        canStart={settingsReady(db.settings)}
        onChangeService={clearService}
        access={{
          output: can(user.roles, "screen.output"),
          bulletin: can(user.roles, "screen.bulletin"),
          editor: can(user.roles, "screen.editor"),
        }}
      />
    );
  }

  return (
    <div className="page">
      <div>
        <h1 className="font-serif text-4xl">프레젠터</h1>
        <p className="mt-2 text-muted">예배를 고르면 슬라이드 목록·현재/다음 미리보기·이전/다음으로 송출을 조작합니다.</p>
      </div>

      {choices.length === 0 ? (
        <p className="mt-8 text-muted">넘길 예배가 없습니다. 예배 탭에서 순서를 준비해 주세요.</p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {choices.map((item) => (
            <li key={item.id}>
              <PresenterServiceCard
                service={item}
                suggested={item.id === activeId}
                onPick={() => selectService(item.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PresenterServiceCard({
  service,
  suggested,
  onPick,
}: {
  service: Service;
  suggested: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex w-full flex-wrap items-start justify-between gap-3 rounded-2xl border px-5 py-4 text-left transition hover:border-pine ${
        suggested ? "border-pine bg-pine-soft/40" : "border-line bg-card"
      }`}
    >
      <div>
        <p className="text-sm text-muted">
          {formatKoreanDate(service.date)} · {formatTime(service.time)} · {service.place}
          {suggested ? " · 추천" : ""}
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink">{service.title}</h2>
        <p className="mt-2 text-sm text-muted">
          {service.items.length}개 순서 · 슬라이드 목록과 현재/다음 미리보기로 넘깁니다
        </p>
      </div>
      <StatusBadge status={service.status} />
    </button>
  );
}
