"use client";

import { useState } from "react";
import { seasonGuide, seasonIconKey } from "@/calendar/rules";

const SEASON_ICON_NAMES = ["advent", "christmas", "epiphany", "ash", "lent", "palm", "cross", "easter", "ascension", "pentecost"] as const;

type SeasonIconName = (typeof SEASON_ICON_NAMES)[number];

function isSeasonIconName(name: string): name is SeasonIconName {
  return (SEASON_ICON_NAMES as readonly string[]).includes(name);
}

/** 숫자 옆의 작은 제목입니다. 안내는 올리거나 눌렀을 때만 나옵니다. */
export function SeasonMark({ title }: { title: string }) {
  const icon = seasonIconKey(title);
  const guide = seasonGuide(title);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = Boolean(guide) && (hover || pinned);
  return (
    <span
      className="relative inline-flex max-w-full"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        data-testid="season-mark"
        data-season={title}
        aria-expanded={open}
        className="inline-flex max-w-full items-center gap-0.5 text-left text-[10px] leading-3 text-[#8a4b32]"
        style={{ fontFamily: '"JejuGothic", "제주고딕", sans-serif' }}
        onClick={() => setPinned((current) => !current)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        {icon && isSeasonIconName(icon) ? <SeasonGlyph name={icon} /> : null}
        <span className="min-w-0 break-words">{title}</span>
      </button>
      {open ? (
        <span
          role="tooltip"
          data-testid="season-guide"
          className="absolute left-0 top-full z-30 mt-1 w-44 rounded-xl border border-[#e4d8c8] bg-white p-2 text-left text-[11px] leading-snug text-[#241c16] shadow-sm"
          style={{ fontFamily: '"JejuGothic", "제주고딕", sans-serif' }}
        >
          {guide}
        </span>
      ) : null}
    </span>
  );
}

function SeasonGlyph({ name }: { name: SeasonIconName }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" data-testid="season-icon" data-icon={name} className="shrink-0">
      {name === "advent" ? (
        <>
          <rect x="5.4" y="5" width="3.2" height="7" rx="0.4" fill="currentColor" />
          <ellipse cx="7" cy="3.2" rx="1.15" ry="1.7" fill="currentColor" />
        </>
      ) : null}
      {name === "christmas" ? (
        <polygon points="7,0.8 8.4,4.8 12.6,5 9.4,7.6 10.5,11.8 7,9.5 3.5,11.8 4.6,7.6 1.4,5 5.6,4.8" fill="currentColor" />
      ) : null}
      {name === "epiphany" ? <path d="M1.8 10.6 3.6 3.8 7 7.6 10.4 3.8 12.2 10.6Z" fill="currentColor" /> : null}
      {name === "ash" ? <circle cx="7" cy="7" r="3.1" fill="currentColor" /> : null}
      {name === "lent" ? (
        <>
          <path d="M1.6 7c2-2.6 6-2.6 8.2 0-2.2 2.6-6.2 2.6-8.2 0Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9.6 7 12.6 4.4v5.2Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="4" cy="6.5" r="0.45" fill="currentColor" />
        </>
      ) : null}
      {name === "palm" ? <path d="M7 12.4C7 8.2 4.2 6.2 1.8 3.2 4.8 5 6.6 4.8 7 1.6 7.4 4.8 9.2 5 12.2 3.2 9.8 6.2 7 8.2 7 12.4Z" fill="currentColor" /> : null}
      {name === "cross" ? <path d="M5.8 1h2.4v4.2H12v2.4H8.2V13H5.8V7.6H2V5.2h3.8Z" fill="currentColor" /> : null}
      {name === "easter" ? (
        <>
          <path d="M3 12V7.2a4 4 0 0 1 8 0V12" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 12V8.2h2V12" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </>
      ) : null}
      {name === "ascension" ? (
        <path d="M7 12.2V3.2M3.8 6.2 7 3l3.2 3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {name === "pentecost" ? <path d="M7 12.6c-2.4-1.4-3-3.6-1.8-5.2.2 1.6 1.2 1.8 1.5.4.4-2 1.2-3.6 1.5-4.6.7 2 2.4 3.2 2.4 6 0 2.4-1.6 3.6-3.6 3.4Z" fill="currentColor" /> : null}
    </svg>
  );
}
