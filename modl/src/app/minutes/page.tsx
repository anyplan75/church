import Link from "next/link";
import { AccessScreen } from "@/components/access-screen";
import { CHOICE_PURPLE, choiceButtonClass, choiceButtonStyle, choiceRowClass } from "@/components/choice-buttons";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermArea, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { createMinutesAction } from "@/server/minutes/actions";
import { loadMinutesHome } from "@/server/minutes/service";
import { viewerIsGuest } from "@/server/login/access";

export const dynamic = "force-dynamic";

export default async function MinutesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; gathering?: string }>;
}) {
  const query = await searchParams;
  const page = await loadMinutesHome();
  if (!page.ok && (await viewerIsGuest())) return <AccessScreen />;
  if (!page.ok) {
    return (
      <section className="grid min-w-0 gap-4">
        <TermHeading termKey="minutes" level={1} />
        <p className="leading-relaxed">{page.message}</p>
      </section>
    );
  }
  const selected = page.gatherings.find((gathering) => gathering.id === query.gathering) ?? page.gatherings[0] ?? null;
  const minutes = selected ? page.minutes.filter((row) => row.groupId === selected.id) : [];

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="minutes" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <p className="leading-relaxed text-[#5c5148]">회의록은 모들마다 나뉩니다. 교회 회의록은 만들지 않습니다.</p>
      {page.gatherings.length === 0 ? (
        <p className="leading-relaxed">속한 모들이 없습니다.</p>
      ) : (
        <div data-testid="minutes-scopes" className={choiceRowClass}>
          {page.gatherings.map((gathering) => {
            const on = selected?.id === gathering.id;
            return (
              <Link
                key={gathering.id}
                href={`/minutes?gathering=${gathering.id}`}
                data-testid="minutes-scope"
                data-kind="gathering"
                data-on={on ? "yes" : "no"}
                className={choiceButtonClass}
                style={choiceButtonStyle(on, CHOICE_PURPLE)}
              >
                {gathering.name}
              </Link>
            );
          })}
        </div>
      )}
      {selected ? (
        <form action={createMinutesAction} id="minutes-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
          <input type="hidden" name="gatheringId" value={selected.id} />
          <TermField termKey="field_meeting_date" name="meetingDate" type="date" required />
          <TermArea termKey="field_attendees" name="attendeesText" rows={3} />
          <TermArea termKey="field_minutes" name="content" required rows={6} />
          <TermArea termKey="field_attachment_urls" name="attachmentText" rows={3} />
          <SubmitButton termKey="save_minutes" testId="save-minutes" />
        </form>
      ) : null}
      {minutes.length === 0 ? (
        <p className="leading-relaxed">
          <TermText termKey="minutes_empty" />
        </p>
      ) : (
        <ul className="grid gap-2">
          {minutes.map((row) => (
            <li key={row.id} data-testid="minutes-row" className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
              <span className="text-[#5c5148]">{row.meetingDate}</span>
              <p className="break-words whitespace-pre-wrap">{row.content}</p>
              {row.attendees.length > 0 ? <p className="break-words text-[#5c5148]">{row.attendees.join(", ")}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
