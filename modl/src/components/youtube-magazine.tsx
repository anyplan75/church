"use client";

import { useEffect, useId, useState } from "react";
import { youtubeEmbedUrl } from "@/archive/rules";

type YoutubeVideo = { id: string; title: string; url: string; thumbnailUrl: string };

/**
 * 유튜브 최신 글 목록입니다.
 * 목록에서는 썸네일만 두고, 누르면 같은 페이지의 큰 재생 창에서 재생합니다.
 * 넓은 화면에서는 왼쪽 아이폰 프레임 높이에 맞춰 세 칸을 나눠 채웁니다.
 */
export function YoutubeMagazine({
  videos,
  fillPhoneHeight = false,
}: {
  videos: readonly YoutubeVideo[];
  /** 왼쪽 아이폰 프레임과 같은 높이로 3칸을 채울 때 켭니다. */
  fillPhoneHeight?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const titleId = useId();
  const active = videos.find((video) => video.id === activeId) ?? null;
  const embedSrc = active ? youtubeEmbedUrl(active.url) : null;
  const shown = videos.slice(0, 3);

  useEffect(() => {
    if (!activeId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [activeId]);

  if (shown.length === 0) return null;

  return (
    <>
      <ul
        data-testid="youtube-magazine"
        data-youtube-count={shown.length}
        data-youtube-fill={fillPhoneHeight ? "phone" : "stack"}
        className={
          fillPhoneHeight
            ? "grid h-full min-h-0 list-none grid-rows-3 gap-2"
            : "grid list-none grid-cols-1 gap-4"
        }
      >
        {shown.map((video) => (
          <li
            key={video.id}
            className={fillPhoneHeight ? "grid min-h-0 content-stretch" : "grid content-start gap-2"}
            data-testid="youtube-card"
          >
            <button
              type="button"
              data-testid="youtube-thumb"
              data-youtube-id={video.id}
              className={
                fillPhoneHeight
                  ? "grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1 text-left"
                  : "grid gap-2 text-left"
              }
              onClick={() => setActiveId(video.id)}
              aria-haspopup="dialog"
            >
              <span
                className={
                  fillPhoneHeight
                    ? "relative block h-full min-h-0 overflow-hidden rounded-2xl bg-[#e8e2d9]"
                    : "relative block overflow-hidden rounded-2xl bg-[#e8e2d9]"
                }
              >
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className={fillPhoneHeight ? "h-full w-full object-cover" : "aspect-video w-full object-cover"}
                />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111827]/80 text-white sm:h-12 sm:w-12">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                      <path d="M8 5.5v13l11-6.5z" />
                    </svg>
                  </span>
                </span>
              </span>
              <span className="truncate text-sm font-semibold leading-snug">{video.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {active && embedSrc ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="youtube-lightbox"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/72 p-3 sm:p-6"
          onClick={() => setActiveId(null)}
        >
          <div className="grid w-full max-w-4xl gap-3" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 id={titleId} className="min-w-0 text-base font-semibold leading-snug text-white sm:text-lg">
                {active.title}
              </h3>
              <button
                type="button"
                data-testid="youtube-lightbox-close"
                className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => setActiveId(null)}
              >
                닫기
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl bg-black shadow-none">
              <iframe
                key={active.id}
                data-testid="youtube-lightbox-player"
                src={`${embedSrc}?autoplay=1&rel=0`}
                title={active.title}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <p className="text-center text-sm text-white/80">배경을 누르거나 Esc를 누르면 목록으로 돌아갑니다.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
