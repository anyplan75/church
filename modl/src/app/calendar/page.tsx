import Link from "next/link";
import { monthDayMarks, seoulToday, shiftDateKey, weekDateKeys, WEEKDAY_LABELS, type MonthDayCell } from "@/calendar/rules";
import { SeasonMark } from "@/components/season-mark";
import { ScheduleItem } from "@/components/schedule-item";
import { CategoryField, LeaderOnlyField } from "@/components/choice-fields";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { LoginGuide } from "@/components/login-guide";
import { viewerIsGuest } from "@/server/login/access";
import { saveCalendarEventAction } from "@/server/calendar/actions";
import { loadCalendarMonth } from "@/server/calendar/service";

export const dynamic = "force-dynamic";

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthsOf(dates: readonly string[]): Array<{ year: number; month: number }> {
  const seen = new Set<string>();
  const months: Array<{ year: number; month: number }> = [];
  for (const date of dates) {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const key = `${year}-${month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    months.push({ year, month });
  }
  return months;
}

type CalendarPageData = Awaited<ReturnType<typeof loadCalendarMonth>>;

function mergePages(pages: CalendarPageData[]): CalendarPageData {
  const ready = pages.filter((page) => page.ok);
  const first = ready[0];
  if (!first) return pages[0] ?? { ok: false, message: "일정을 불러오지 못했습니다." };
  const events = new Map(ready.flatMap((page) => page.events.map((event) => [event.id, event] as const)));
  const birthdays = new Map(ready.flatMap((page) => page.birthdays.map((mark) => [`${mark.memberId}:${mark.date}`, mark] as const)));
  const googleEvents = new Map(ready.flatMap((page) => page.googleEvents.map((event) => [event.id, event] as const)));
  return {
    ...first,
    events: [...events.values()],
    birthdays: [...birthdays.values()],
    googleEvents: [...googleEvents.values()],
  };
}

function cellsForDates(dates: readonly string[], page: Extract<CalendarPageData, { ok: true }> | null): MonthDayCell[] {
  const byDate = new Map<string, MonthDayCell>();
  for (const item of monthsOf(dates)) {
    const cells = monthDayMarks(item.year, item.month, page?.events ?? [], page?.birthdays ?? [], page?.googleEvents ?? []);
    for (const cell of cells) {
      if (cell.date) byDate.set(cell.date, cell);
    }
  }
  return dates.map((date) => byDate.get(date) ?? { date, day: Number(date.slice(8, 10)), marks: [] });
}

function DayMarks({ cell }: { cell: MonthDayCell }) {
  const seasons = cell.marks.filter((mark) => mark.kind === "season");
  const rest = cell.marks.filter((mark) => mark.kind !== "season");
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <span className="text-xs text-[#241c16] sm:text-sm">{cell.day}</span>
        {seasons.map((mark) => (
          <SeasonMark key={mark.key} title={mark.title} />
        ))}
      </div>
      {rest.length > 0 ? (
        <ul className="grid gap-1">
          {rest.map((mark) => (
            <ScheduleItem key={mark.key} mark={mark} />
          ))}
        </ul>
      ) : null}
    </>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; year?: string; month?: string; view?: string; week?: string }>;
}) {
  const query = await searchParams;
  const today = seoulToday();
  const todayKey = dateKey(today.year, today.month, today.day);
  const requestedYear = Number(query.year);
  const requestedMonth = Number(query.month);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : today.year;
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : today.month;
  const view = query.view === "week" ? "week" : "month";
  const requestedWeek = weekDateKeys(query.week ?? "");
  const weekAnchor = requestedWeek[0] ? (query.week as string) : today.year === year && today.month === month ? todayKey : dateKey(year, month, 1);
  const weekKeys = weekDateKeys(weekAnchor);
  const sunday = weekKeys[0] ?? todayKey;
  const weekDates = weekKeys.length === 7 ? weekKeys : weekDateKeys(todayKey);
  const page = view === "week" ? mergePages(await Promise.all(monthsOf(weekDates).map((item) => loadCalendarMonth(item.year, item.month)))) : await loadCalendarMonth(year, month);
  const guest = !page.ok && (await viewerIsGuest());
  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const monthText = String(month).padStart(2, "0");
  const monthCells = page.ok
    ? monthDayMarks(year, month, page.events, page.birthdays, page.googleEvents)
    : guest
      ? monthDayMarks(year, month, [], [], [])
      : [];
  const weeks: Array<typeof monthCells> = [];
  for (let index = 0; index < monthCells.length; index += 7) weeks.push(monthCells.slice(index, index + 7));
  const weekCells = page.ok ? cellsForDates(weekDates, page) : guest ? cellsForDates(weekDates, null) : [];
  const hasMarks = (view === "week" ? weekCells : monthCells).some((cell) => cell.marks.some((mark) => mark.kind !== "season"));
  const mid = weekDates[3] ?? sunday;
  const monthTab = `/calendar?view=month&year=${view === "week" ? Number(mid.slice(0, 4)) : year}&month=${view === "week" ? Number(mid.slice(5, 7)) : month}`;
  const weekTab = `/calendar?view=week&week=${view === "week" ? sunday : weekDateKeys(today.year === year && today.month === month ? todayKey : dateKey(year, month, 1))[0] ?? todayKey}`;
  const formDay = view === "week" ? (weekDates[0] ?? todayKey) : `${year}-${monthText}-01`;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="calendar" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok && !guest ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <nav role="tablist" aria-label="일정 보기" data-testid="calendar-view-tabs" className="flex flex-wrap gap-2">
            <Link
              href={monthTab}
              role="tab"
              aria-selected={view === "month"}
              data-testid="calendar-tab-month"
              className={`rounded-full px-3 py-2 text-sm font-semibold ${view === "month" ? "bg-[#111827] text-white" : "bg-[#fffaf3] text-[#475569]"}`}
            >
              월별일정
            </Link>
            <Link
              href={weekTab}
              role="tab"
              aria-selected={view === "week"}
              data-testid="calendar-tab-week"
              className={`rounded-full px-3 py-2 text-sm font-semibold ${view === "week" ? "bg-[#111827] text-white" : "bg-[#fffaf3] text-[#475569]"}`}
            >
              주간일정
            </Link>
          </nav>
          {view === "week" ? (
            <nav aria-label="주 이동" className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/calendar?view=week&week=${shiftDateKey(sunday, -7)}`} className="rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
                이전 주
              </Link>
              <span className="font-medium leading-snug">
                {Number(weekDates[0]?.slice(5, 7))}월 {Number(weekDates[0]?.slice(8, 10))}일 – {Number(weekDates[6]?.slice(5, 7))}월 {Number(weekDates[6]?.slice(8, 10))}일
              </span>
              <Link href={`/calendar?view=week&week=${shiftDateKey(sunday, 7)}`} className="rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
                다음 주
              </Link>
            </nav>
          ) : (
            <nav aria-label="달 이동" className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/calendar?view=month&year=${previous.year}&month=${previous.month}`} className="rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
                이전 달
              </Link>
              <span className="font-medium leading-snug">
                {year}년 {month}월
              </span>
              <Link href={`/calendar?view=month&year=${next.year}&month=${next.month}`} className="rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
                다음 달
              </Link>
            </nav>
          )}
          {page.ok && page.googleCanWrite ? (
            <p className="leading-relaxed text-[#5c5148]">일정을 저장하면 구글 달력에도 보내고, 받은 일정 번호를 남겨 둡니다.</p>
          ) : page.ok && page.googleRead === "needs_share" ? (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력은 공유가 되어야 일정이 보입니다.
            </p>
          ) : page.ok && page.googleNeedsCalendar ? (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력 번호가 아직 없습니다. 모들 달력만 쓰고, 없는 일정은 만들지 않습니다.
            </p>
          ) : page.ok && page.googleRead === "failed" ? (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력을 읽지 못했습니다. 모들에 저장된 일정만 보여 줍니다.
            </p>
          ) : page.ok && page.googleHasId ? null : page.ok ? (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력 열쇠가 있어야 보낼 수 있습니다. 모들 달력은 그대로 씁니다.
            </p>
          ) : null}
          {view === "week" ? (
            {/* 칸 높이는 이전 6rem의 네 배입니다. 좁은 화면은 일곱 요일을 세로로 쌓아 페이지가 스크롤됩니다. */}
            <ol data-testid="week-board" className="grid list-none grid-cols-1 gap-2 lg:grid-cols-7">
              {weekCells.map((cell, index) => (
                <li
                  key={cell.date ?? `week-${index}`}
                  data-testid="week-day"
                  data-date={cell.date ?? ""}
                  className="flex h-96 shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-[#e4d8c8] bg-[#fffaf3] p-2"
                >
                  <span className="text-xs font-medium text-[#5c5148]">{WEEKDAY_LABELS[index]}</span>
                  <DayMarks cell={cell} />
                </li>
              ))}
            </ol>
          ) : (
            <div data-testid="month-grid" data-google-read={page.ok ? page.googleRead : "guest"}>
              <table className="w-full table-fixed border-separate border-spacing-1 text-left">
                <caption className="sr-only">
                  {year}년 {month}월 일정
                </caption>
                <thead>
                  <tr>
                    {WEEKDAY_LABELS.map((label) => (
                      <th key={label} scope="col" className="px-1 py-1 text-center text-sm font-medium text-[#5c5148]">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, weekIndex) => (
                    <tr key={`${year}-${month}-${weekIndex}`}>
                      {week.map((cell, cellIndex) => (
                        <td key={cell.date ?? `empty-${weekIndex}-${cellIndex}`} className="align-top p-0">
                          {cell.date ? (
                            <div
                              data-testid="calendar-day"
                              data-date={cell.date}
                              className="flex min-h-16 flex-col gap-1 rounded-xl border border-[#e4d8c8] bg-[#fffaf3] p-1 sm:min-h-24 sm:p-1.5"
                            >
                              <DayMarks cell={cell} />
                            </div>
                          ) : (
                            <div className="min-h-16 rounded-xl border border-[#eef2f6] bg-[#f8fafc] sm:min-h-24" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasMarks ? null : <p className="leading-relaxed">{view === "week" ? "이 주에는 보이는 일정이 없습니다." : "이 달에는 보이는 일정이 없습니다."}</p>}
          {page.ok ? (
            <p className="leading-relaxed text-[#5c5148]" data-testid="calendar-scope-note">
              내가 속한 교회 일정과 내가 속한 모들 일정만 보입니다.
            </p>
          ) : null}
          {guest ? <LoginGuide compact /> : page.ok && page.canEdit ? (
            <form action={saveCalendarEventAction} id="event-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <TermField termKey="field_event_title" name="title" required />
              <TermField termKey="field_event_start" name="startAt" type="datetime-local" required defaultValue={`${formDay}T10:00`} />
              <TermField termKey="field_event_end" name="endAt" type="datetime-local" required defaultValue={`${formDay}T11:00`} />
              <CategoryField />
              <LeaderOnlyField />
              <PlaceChoice places={page.places} />
              <SubmitButton termKey="save_event" />
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}

function PlaceChoice({
  places,
  selected = "",
}: {
  places: readonly { id: string; name: string; kind: "church" | "gathering" }[];
  selected?: string | null;
}) {
  const current = places.find((place) => `${place.kind}:${place.id}` === selected) ?? places[0];
  if (!current) return null;
  return (
    <label className="grid gap-1">
      <span className="font-semibold">교회 또는 모들</span>
      <select name="placeRef" defaultValue={`${current.kind}:${current.id}`} className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-6">
        {places.map((place) => (
          <option key={`${place.kind}:${place.id}`} value={`${place.kind}:${place.id}`}>
            {place.kind === "church" ? "교회" : "모들"} · {place.name}
          </option>
        ))}
      </select>
    </label>
  );
}
