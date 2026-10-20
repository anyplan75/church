import Link from "next/link";
import { CategoryField, LeaderOnlyField } from "@/components/choice-fields";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { saveCalendarEventAction } from "@/server/calendar/actions";
import { loadCalendarMonth } from "@/server/calendar/service";
import type { TermKey } from "@/theme/dictionary";

export const dynamic = "force-dynamic";

const CATEGORY_TERM = {
  RETREAT: "category_retreat",
  EVENT: "category_event",
  BIRTHDAY: "category_birthday",
  HOLIDAY: "category_holiday",
  ETC: "category_etc",
} as const;

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
  const now = new Date();
  const requestedYear = Number(query.year);
  const requestedMonth = Number(query.month);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : now.getFullYear();
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : now.getMonth() + 1;
  const page = await loadCalendarMonth(year, month);
  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const monthText = String(month).padStart(2, "0");

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="calendar" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          <nav aria-label="달" className="flex flex-wrap items-center gap-2">
            <Link href={`/calendar?year=${previous.year}&month=${previous.month}`} className="rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
              이전달
            </Link>
            <span className="font-semibold leading-snug">
              {year}-{monthText}
            </span>
            <Link href={`/calendar?year=${next.year}&month=${next.month}`} className="rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
              다음달
            </Link>
          </nav>
          {page.googleReady ? (
            <p className="leading-relaxed text-[#5c5148]">일정을 저장하면 구글 달력에도 보내고, 받은 일정 번호를 남겨 둡니다.</p>
          ) : (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력 열쇠가 있어야 보낼 수 있습니다. 모들 달력은 그대로 씁니다.
            </p>
          )}
          {page.canEdit ? (
            <form action={saveCalendarEventAction} id="event-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <TermField termKey="field_event_title" name="title" required />
              <TermField termKey="field_event_start" name="startAt" type="datetime-local" required defaultValue={`${year}-${monthText}-01T10:00`} />
              <TermField termKey="field_event_end" name="endAt" type="datetime-local" required defaultValue={`${year}-${monthText}-01T11:00`} />
              <CategoryField />
              <LeaderOnlyField />
              <SubmitButton termKey="save_event" />
            </form>
          ) : (
            <p className="leading-relaxed text-[#5c5148]">일정 등록은 사역자, 임원, 모들 테우리만 합니다. 리더만 보는 일정은 이 화면에 나오지 않습니다.</p>
          )}
          <ul className="grid gap-2">
            {page.events.map((event) => (
              <li key={event.id}>
                <Link href={`/calendar/${event.id}`} className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                  <span className="text-[#5c5148]">{event.startAt.replace("T", " ")}</span>
                  <span className="break-words font-semibold" data-testid="event-title">
                    {event.title}
                  </span>
                  <TermText termKey={CATEGORY_TERM[event.category] as TermKey} />
                  {event.isLeaderOnly ? <TermText termKey="leader_only_event" /> : null}
                </Link>
              </li>
            ))}
            {page.birthdays.map((birthday) => (
              <li key={birthday.memberId} data-testid="birthday-name" className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                <span className="text-[#5c5148]">{birthday.date}</span>
                <span className="break-words font-semibold">{birthday.name}</span>
                <TermText termKey="category_birthday" />
              </li>
            ))}
          </ul>
          {page.events.length === 0 && page.birthdays.length === 0 ? <p className="leading-relaxed">이 달에는 보이는 일정이 없습니다.</p> : null}
        </>
      )}
    </section>
  );
}
