import Link from "next/link";
import { monthDayMarks, seoulToday, WEEKDAY_LABELS } from "@/calendar/rules";
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

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; year?: string; month?: string }>;
}) {
  const query = await searchParams;
  const today = seoulToday();
  const requestedYear = Number(query.year);
  const requestedMonth = Number(query.month);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : today.year;
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : today.month;
  const page = await loadCalendarMonth(year, month);
  if (!page.ok && (await viewerIsGuest())) {
    return (
      <section className="grid min-w-0 gap-4">
        <TermHeading termKey="calendar" level={1} />
        <LoginGuide compact />
      </section>
    );
  }
  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const monthText = String(month).padStart(2, "0");
  const cells = page.ok ? monthDayMarks(year, month, page.events, page.birthdays, page.googleEvents) : [];
  const weeks: Array<typeof cells> = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  const hasMarks = cells.some((cell) => cell.marks.length > 0);

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="calendar" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]" data-testid="calendar-scope-note">
            내가 속한 교회 일정과 내가 속한 모들 일정만 보입니다.
          </p>
          <nav aria-label="달 이동" className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/calendar?year=${previous.year}&month=${previous.month}`} className="rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
              이전 달
            </Link>
            <span className="font-medium leading-snug">
              {year}년 {month}월
            </span>
            <Link href={`/calendar?year=${next.year}&month=${next.month}`} className="rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
              다음 달
            </Link>
          </nav>
          {page.googleCanWrite ? (
            <p className="leading-relaxed text-[#5c5148]">일정을 저장하면 구글 달력에도 보내고, 받은 일정 번호를 남겨 둡니다.</p>
          ) : page.googleRead === "needs_share" ? (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력은 공유가 되어야 일정이 보입니다.
            </p>
          ) : page.googleNeedsCalendar ? (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력 번호가 아직 없습니다. 모들 달력만 쓰고, 없는 일정은 만들지 않습니다.
            </p>
          ) : page.googleRead === "failed" ? (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력을 읽지 못했습니다. 모들에 저장된 일정만 보여 줍니다.
            </p>
          ) : page.googleHasId ? null : (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력 열쇠가 있어야 보낼 수 있습니다. 모들 달력은 그대로 씁니다.
            </p>
          )}
          <div data-testid="month-grid" data-google-read={page.googleRead}>
            <table className="w-full table-fixed border-separate border-spacing-1 text-left">
              <caption className="sr-only">
                {year}년 {month}월 달력
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
                            <span className="text-xs text-[#241c16] sm:text-sm">{cell.day}</span>
                            <ul className="grid gap-1">
                              {cell.marks.map((mark) => (
                                <li key={mark.key}>
                                  {mark.href ? (
                                    <Link href={mark.href} className="block break-words text-[11px] leading-snug text-[#241c16] sm:text-xs">
                                      <span data-testid="event-title">{mark.title}</span>
                                      {mark.leaderOnly ? <span className="mt-0.5 block text-[10px] text-[#5c5148]">리더만 보는 일정</span> : null}
                                    </Link>
                                  ) : mark.kind === "google" ? (
                                    <span data-testid="google-event" className="block break-words text-[11px] leading-snug text-[#241c16] sm:text-xs">
                                      {mark.title}
                                    </span>
                                  ) : mark.kind === "season" ? (
                                    <span data-testid="season-mark" className="block break-words text-[11px] leading-snug text-[#8a4b32] sm:text-xs">
                                      {mark.title}
                                    </span>
                                  ) : (
                                    <span data-testid="birthday-name" className="block break-words text-[11px] leading-snug text-[#5c5148] sm:text-xs">
                                      {mark.title} 생일
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
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
          {hasMarks ? null : <p className="leading-relaxed">이 달에는 보이는 일정이 없습니다.</p>}
          {page.canEdit ? (
            <form action={saveCalendarEventAction} id="event-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <TermField termKey="field_event_title" name="title" required />
              <TermField termKey="field_event_start" name="startAt" type="datetime-local" required defaultValue={`${year}-${monthText}-01T10:00`} />
              <TermField termKey="field_event_end" name="endAt" type="datetime-local" required defaultValue={`${year}-${monthText}-01T11:00`} />
              <CategoryField />
              <LeaderOnlyField />
              <GroupChoice groups={page.myGroups} />
              <SubmitButton termKey="save_event" />
            </form>
          ) : (
            <p className="leading-relaxed text-[#5c5148]">일정 등록은 사역자, 임원, 모들 테우리만 합니다. 리더만 보는 일정은 이 화면에 나오지 않습니다.</p>
          )}
        </>
      )}
    </section>
  );
}

function GroupChoice({ groups, selected = "" }: { groups: readonly { id: string; name: string }[]; selected?: string | null }) {
  if (groups.length === 0) return <input type="hidden" name="groupId" value="" />;
  return (
    <label className="grid gap-1">
      <span className="font-semibold">모들</span>
      <select name="groupId" defaultValue={selected ?? ""} className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-6">
        <option value="">교회 일정</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </label>
  );
}
