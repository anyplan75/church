import { AccessScreen } from "@/components/access-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermArea, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { createMinutesAction } from "@/server/minutes/actions";
import { loadMinutesHome } from "@/server/minutes/service";

export const dynamic = "force-dynamic";

export default async function MinutesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadMinutesHome();
  if (!page.ok) return <AccessScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="minutes" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          <form action={createMinutesAction} id="minutes-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <TermField termKey="field_meeting_date" name="meetingDate" type="date" required />
            <TermArea termKey="field_attendees" name="attendeesText" rows={3} />
            <TermArea termKey="field_minutes" name="content" required rows={6} />
            <TermArea termKey="field_attachment_urls" name="attachmentText" rows={3} />
            <SubmitButton termKey="save_minutes" testId="save-minutes" />
          </form>
          {page.minutes.length === 0 ? (
            <p className="leading-relaxed">
              <TermText termKey="minutes_empty" />
            </p>
          ) : (
            <ul className="grid gap-2">
              {page.minutes.map((row) => (
                <li key={row.id} data-testid="minutes-row" className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                  <span className="text-[#5c5148]">{row.meetingDate}</span>
                  <p className="break-words whitespace-pre-wrap">{row.content}</p>
                  {row.attendees.length > 0 ? <p className="break-words text-[#5c5148]">{row.attendees.join(", ")}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </>
    </section>
  );
}
