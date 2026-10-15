"use client";

import { useEffect, type ReactNode } from "react";
import { FolderMatchLine, useServiceFolder } from "@/components/service-folder";
import { buildDesk, SLIDE_KEYS, type DeskSlide } from "@/lib/slide-show";
import type { Person, Service, Song } from "@/lib/types";

export function SlideDesk({
  service,
  people,
  songs,
  groupIndex,
  inGroup,
  onJump,
}: {
  service: Service;
  people: Person[];
  songs: Song[];
  groupIndex: number;
  inGroup: number;
  onJump: (groupIndex: number, inGroup: number) => void;
}) {
  const folder = useServiceFolder(service, songs);
  const local: Record<string, string[]> = {};
  for (const [id, fill] of Object.entries(folder.fills)) {
    if (fill.slides.length > 0) local[id] = fill.slides;
  }

  const desk = buildDesk(service, people, songs, local);
  const current = desk.slides.find((slide) => slide.groupIndex === groupIndex && slide.inGroup === inGroup) ?? desk.slides.find((slide) => slide.groupIndex === groupIndex) ?? desk.slides[0];
  const next = current ? desk.slides[current.flat + 1] : undefined;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key;
      if (key === "ArrowRight" || key === "ArrowDown" || key === " ") {
        event.preventDefault();
        if (current && desk.slides[current.flat + 1]) {
          const target = desk.slides[current.flat + 1];
          onJump(target.groupIndex, target.inGroup);
        }
        return;
      }
      if (key === "ArrowLeft" || key === "ArrowUp") {
        event.preventDefault();
        if (current && current.flat > 0) {
          const target = desk.slides[current.flat - 1];
          onJump(target.groupIndex, target.inGroup);
        }
        return;
      }
      if (key === "]" || (event.ctrlKey && key === "ArrowDown")) {
        event.preventDefault();
        if (groupIndex + 1 < desk.groups.length) onJump(groupIndex + 1, 0);
        return;
      }
      if (key === "[" || (event.ctrlKey && key === "ArrowUp")) {
        event.preventDefault();
        if (groupIndex > 0) onJump(groupIndex - 1, 0);
        return;
      }
      if (key === "Home") {
        event.preventDefault();
        onJump(0, 0);
        return;
      }
      if (key === "End") {
        event.preventDefault();
        const last = desk.slides[desk.slides.length - 1];
        if (last) onJump(last.groupIndex, last.inGroup);
        return;
      }
      if (/^[1-9]$/.test(key)) {
        const index = Number(key) - 1;
        if (desk.groups[index]) onJump(index, 0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, desk.groups, desk.slides, groupIndex, onJump]);

  return (
    <div className="grid min-h-[70vh] lg:grid-cols-[280px_minmax(0,1fr)_300px]">
      <aside className="border-b border-white/10 lg:h-[calc(100vh-11rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <h2 className="px-4 pt-4 text-sm text-[#d9d0c2]">그룹</h2>
        <ol className="space-y-3 px-3 py-3">
          {desk.groups.map((group) => (
            <li key={group.itemId}>
              <button
                type="button"
                className="w-full rounded-t-lg bg-white/15 px-3 py-1.5 text-left text-sm font-semibold"
                onClick={() => onJump(group.index, 0)}
              >
                {group.index + 1}. {group.label}
              </button>
              <FolderMatchLine fill={folder.fills[group.itemId]} loaded={folder.loaded} light />
              <div className="space-y-1 rounded-b-lg bg-black/20 p-1">
                {desk.slides.slice(group.start, group.start + group.count).map((slide) => (
                  <button
                    key={`${slide.itemId}-${slide.inGroup}`}
                    type="button"
                    className={`block w-full rounded-md px-2 py-2 text-left text-sm ${slide.flat === current?.flat ? "bg-white text-pine" : "text-[#f6f1e6] hover:bg-white/10"}`}
                    onClick={() => onJump(slide.groupIndex, slide.inGroup)}
                  >
                    {slide.inGroup + 1}. {slide.lines[0] || slide.heading}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </aside>
      <section className="px-6 py-8">
        {current ? <SlideCard label="현재" slide={current} large status={<FolderMatchLine fill={folder.fills[current.itemId]} loaded={folder.loaded} light />} /> : <p>슬라이드가 없습니다</p>}
      </section>
      <aside className="border-t border-white/10 px-4 py-6 lg:border-t-0 lg:border-l">
        {next ? <SlideCard label="다음" slide={next} /> : <p className="text-sm text-[#d9d0c2]">다음 슬라이드가 없습니다</p>}
        <ul className="mt-6 space-y-1 text-xs text-[#d9d0c2]">
          {SLIDE_KEYS.map((item) => (
            <li key={item.action}>
              <span className="text-[#f6f1e6]">{item.keys}</span> {item.action}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function SlideCard({ slide, label, large = false, status = null }: { slide: DeskSlide; label: string; large?: boolean; status?: ReactNode }) {
  return (
      <article className={large ? "" : "opacity-90"} data-service-slide={large ? slide.itemId : undefined} data-slide-lines={large ? String(slide.lines.length) : undefined}>
      <p className="text-xs uppercase tracking-wide text-[#d9d0c2]">{label}</p>
      <div className={`mt-2 rounded-2xl bg-[#10241f] text-center ${large ? "min-h-72 p-8" : "p-4"}`}>
        <p className="text-sm text-[#d9d0c2]">{slide.kicker}</p>
        {slide.lines.length > 0 ? (
          <>
            <p className={large ? "mt-6 font-serif text-5xl leading-tight" : "mt-3 font-serif text-2xl leading-tight"}>{slide.lines[0]}</p>
            {slide.lines[1] ? <p className={large ? "mt-4 text-3xl leading-tight" : "mt-2 text-lg leading-tight"}>{slide.lines[1]}</p> : null}
          </>
        ) : (
          <h2 className={large ? "mt-3 font-serif text-5xl leading-tight" : "mt-2 font-serif text-2xl leading-tight"}>{slide.heading}</h2>
        )}
        {status ? <div className="mt-4">{status}</div> : null}
      </div>
    </article>
  );
}

