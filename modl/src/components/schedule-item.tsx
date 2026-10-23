import Link from "next/link";
import type { DayMark } from "@/calendar/rules";

/** 일정 한 줄입니다. 교회·모들 이름은 아주 작게, 이름 옆에 색만 둡니다. */
export function ScheduleItem({ mark }: { mark: DayMark }) {
  const body = (
    <>
      {mark.placeName && mark.placeColor ? (
        <span data-testid="schedule-place" className="mb-0.5 flex items-center gap-1 text-[10px] leading-none text-[#5c5148]">
          <span
            aria-hidden
            data-testid="schedule-place-color"
            data-kind={mark.placeKind ?? ""}
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: mark.placeColor }}
          />
          <span data-testid="schedule-place-name">{mark.placeName}</span>
        </span>
      ) : null}
      {mark.href ? (
        <Link href={mark.href} className="block break-words text-[11px] leading-snug text-[#241c16] sm:text-xs">
          <span data-testid="event-title">{mark.title}</span>
          {mark.leaderOnly ? <span className="mt-0.5 block text-[10px] text-[#5c5148]">리더만 보는 일정</span> : null}
        </Link>
      ) : mark.kind === "google" ? (
        <span data-testid="google-event" className="block break-words text-[11px] leading-snug text-[#241c16] sm:text-xs">
          {mark.title}
        </span>
      ) : (
        <span data-testid="birthday-name" className="block break-words text-[11px] leading-snug text-[#5c5148] sm:text-xs">
          {mark.title} 생일
        </span>
      )}
    </>
  );
  return <li>{body}</li>;
}
