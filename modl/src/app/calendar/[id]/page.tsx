import { CategoryField, LeaderOnlyField } from "@/components/choice-fields";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { deleteCalendarEventAction, saveCalendarEventAction, syncCalendarEventAction } from "@/server/calendar/actions";
import { loadCalendarEvent } from "@/server/calendar/service";

export const dynamic = "force-dynamic";

export default async function CalendarEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = await loadCalendarEvent(id);

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="calendar" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : page.canEdit ? (
        <>
          <form action={saveCalendarEventAction} id="event-edit-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <input type="hidden" name="eventId" value={page.event.id} />
            <TermField termKey="field_event_title" name="title" required defaultValue={page.event.title} />
            <TermField termKey="field_event_start" name="startAt" type="datetime-local" required defaultValue={page.event.startAt} />
            <TermField termKey="field_event_end" name="endAt" type="datetime-local" required defaultValue={page.event.endAt} />
            <CategoryField defaultValue={page.event.category} />
            <LeaderOnlyField defaultChecked={page.event.isLeaderOnly} />
            <SubmitButton termKey="save_event" />
          </form>
          {page.googleCanWrite ? (
            <form action={syncCalendarEventAction} className="grid gap-3">
              <input type="hidden" name="eventId" value={page.event.id} />
              <SubmitButton termKey="google_sync" />
            </form>
          ) : page.googleNeedsCalendar ? (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력 번호가 아직 없습니다. 모들 달력만 쓰고, 없는 일정은 만들지 않습니다.
            </p>
          ) : page.googleHasId ? null : (
            <p data-testid="google-sync-note" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
              구글 달력 열쇠가 있어야 보낼 수 있습니다. 모들 달력은 그대로 씁니다.
            </p>
          )}
          <form action={deleteCalendarEventAction}>
            <input type="hidden" name="eventId" value={page.event.id} />
            <SubmitButton termKey="delete_event" />
          </form>
        </>
      ) : (
        <article className="grid gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
          <h2 className="break-words text-[clamp(1.15rem,1rem+0.4vw,1.4rem)] font-semibold" data-testid="event-title">
            {page.event.title}
          </h2>
          <p>
            {page.event.startAt.replace("T", " ")} – {page.event.endAt.replace("T", " ")}
          </p>
        </article>
      )}
    </section>
  );
}
