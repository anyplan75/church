import Link from "next/link";
import type { DayMark } from "@/calendar/rules";

/** 월별 칸은 제목만, 주간 칸은 제목과 짧은 요약만 보여 줍니다. */
export function ScheduleItem({ mark, mode }: { mark: DayMark; mode: "month" | "week" }) {
  const titleClass =
    mode === "month"
      ? "block truncate text-[11px] leading-snug sm:text-xs"
      : "block break-words text-[11px] leading-snug sm:text-xs";
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
  const placeKey = mark.placeKind && mark.placeId ? `${mark.placeKind}:${mark.placeId}` : "";
  const colored = Boolean(mark.placeColor);
  return (
    <li
      className={`min-w-0 rounded px-0.5 ${colored ? "text-white" : "text-[#241c16]"}`}
      data-schedule-place={placeKey || undefined}
      data-place-color={mark.placeColor ?? undefined}
      style={colored ? { backgroundColor: mark.placeColor ?? undefined } : undefined}
    >
      {title}
      {mode === "week" && mark.summary ? (
        <span data-testid="event-summary" className={`block truncate text-[10px] leading-snug ${colored ? "text-white/90" : "text-[#5c5148]"}`}>
          {mark.summary}
        </span>
      ) : null}
    </li>
  );
}
