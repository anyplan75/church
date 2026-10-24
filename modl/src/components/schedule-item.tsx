import Link from "next/link";
import type { DayMark } from "@/calendar/rules";

/** 월별 칸은 제목만, 주간 칸은 제목과 짧은 요약만 보여 줍니다. */
export function ScheduleItem({ mark, mode }: { mark: DayMark; mode: "month" | "week" }) {
  const titleClass =
    mode === "month"
      ? "block truncate text-[11px] leading-snug text-[#241c16] sm:text-xs"
      : "block break-words text-[11px] leading-snug text-[#241c16] sm:text-xs";
  const title =
    mark.href ? (
      <Link href={mark.href} className={titleClass}>
        <span data-testid="event-title">{mark.title}</span>
      </Link>
    ) : mark.kind === "google" ? (
      <span data-testid="google-event" className={titleClass}>
        {mark.title}
      </span>
    ) : (
      <span data-testid="birthday-name" className={titleClass}>
        {mark.title} 생일
      </span>
    );
  return (
    <li className="min-w-0">
      {title}
      {mode === "week" && mark.summary ? (
        <span data-testid="event-summary" className="block truncate text-[10px] leading-snug text-[#5c5148]">
          {mark.summary}
        </span>
      ) : null}
    </li>
  );
}
