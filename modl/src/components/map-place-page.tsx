"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PromoBoard } from "@/components/promo-board";
import { PromoSns } from "@/components/promo-sns";
import { loadMapPromoAction, saveChurchIntroAction, type MapPromoPayload } from "@/server/promo/actions";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; page: MapPromoPayload }
  | { status: "error"; message: string };

/** 지도에서 고른 교회나 모들의 홍보 페이지입니다. 작은 카드가 아니라 소개·인스타그램·유튜브·게시판이 이 창 안에 있습니다. */
export function MapPlacePage({
  kind,
  id,
  title,
  fallbackIntro,
  canEditIntro,
  subscribed,
  subscribing,
  onSubscribe,
  onClose,
  onEdit,
  facts,
  guide,
  statusNote,
}: {
  kind: "church" | "gathering";
  id: string;
  title: string;
  fallbackIntro: string;
  canEditIntro: boolean;
  subscribed: boolean;
  subscribing: boolean;
  onSubscribe: () => void;
  onClose: () => void;
  onEdit?: () => void;
  facts?: ReactNode;
  guide?: ReactNode;
  statusNote?: ReactNode;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [localIntro, setLocalIntro] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLocalIntro(null);
    setState({ status: "loading" });
    void loadMapPromoAction(kind, id).then((result) => {
      if (!alive) return;
      setState(result.ok ? { status: "ready", page: result.page } : { status: "error", message: result.message });
    });
    return () => {
      alive = false;
    };
  }, [kind, id]);

  const page = state.status === "ready" ? state.page : null;
  const intro = localIntro ?? (page ? page.intro : fallbackIntro);
  const instagramAccount = page?.instagramAccount ?? "";

  return (
    <div className="flex h-full min-h-0 flex-col" data-promo-status={state.status}>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e5e7eb] px-4 py-4">
        <div className="grid min-w-0 gap-1">
          <p className="text-sm font-semibold text-[#5c5148]">{kind === "church" ? "교회" : "모들"}</p>
          <h2 className="text-2xl font-semibold leading-snug" style={{ fontFamily: '"JejuMyeongjo", "제주명조", serif' }}>
            {page?.name || title}
          </h2>
        </div>
        <button type="button" data-testid="map-promo-close" className="shrink-0 rounded-xl px-3 py-2 text-[#4b5563]" onClick={onClose}>
          닫기
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {subscribed ? (
              <span className="text-sm text-[#4b5563]">구독 중</span>
            ) : (
              <button
                type="button"
                data-testid="map-subscribe"
                disabled={subscribing}
                className="rounded-xl bg-[#111827] px-3 py-2 text-sm font-semibold text-white disabled:bg-[#e5e7eb]"
                onClick={onSubscribe}
              >
                구독
              </button>
            )}
            {onEdit ? (
              <button type="button" data-testid="map-church-edit" className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-semibold" onClick={onEdit}>
                수정
              </button>
            ) : null}
            {page?.manager ? (
              <Link href={`/promo/${kind}/${id}/settings`} data-testid="promo-settings" className="rounded-xl bg-[#111827] px-3 py-2 text-sm font-semibold text-white">
                설정
              </Link>
            ) : null}
          </div>
          {statusNote}
          {state.status === "loading" ? <p className="leading-relaxed text-[#5c5148]">홍보 페이지를 열고 있습니다.</p> : null}
          {state.status === "error" ? (
            <p role="alert" className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">
              {state.message}
            </p>
          ) : null}
          <section className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4" data-testid="map-promo-intro">
            <h3 className="font-semibold">소개</h3>
            {intro ? <p className="whitespace-pre-wrap leading-relaxed">{intro}</p> : <p className="leading-relaxed text-[#5c5148]">소개가 아직 없습니다.</p>}
            {canEditIntro && kind === "church" ? <IntroEditor churchId={id} initial={intro} onSaved={setLocalIntro} /> : null}
          </section>
          <PromoSns
            headingLevel="h3"
            loading={state.status === "loading"}
            instagramAccount={instagramAccount}
            instagram={page?.instagram ?? null}
            youtube={page?.youtube ?? null}
          />
          <section className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4" data-testid="map-promo-board">
            <h3 className="font-semibold">게시판</h3>
            {state.status === "loading" ? <p className="leading-relaxed text-[#5c5148]">게시판을 읽고 있습니다.</p> : <PromoBoard tabs={page?.tabs ?? []} />}
          </section>
          {facts ? <div className="grid gap-2 rounded-3xl border border-[#e5e7eb] p-4">{facts}</div> : null}
          {guide ? <div className="grid gap-2">{guide}</div> : null}
        </div>
      </div>
    </div>
  );
}

function IntroEditor({ churchId, initial, onSaved }: { churchId: string; initial: string; onSaved: (intro: string) => void }) {
  const [text, setText] = useState(initial);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setText(initial);
  }, [initial]);
  return (
    <form
      className="grid gap-2"
      data-testid="church-promo"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void saveChurchIntroAction(churchId, text).then((result) => {
          if (result.ok) onSaved(text.trim());
          setNote(result.ok ? "소개를 저장했습니다." : result.message);
          setPending(false);
        });
      }}
    >
      <label className="grid gap-1">
        <span className="font-semibold">소개 고치기</span>
        <textarea
          value={text}
          data-testid="church-promo-intro-input"
          rows={4}
          className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 leading-snug"
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button type="submit" disabled={pending} className="w-fit rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 font-semibold">
        소개 저장
      </button>
      {note ? <p className="leading-relaxed">{note}</p> : null}
    </form>
  );
}
