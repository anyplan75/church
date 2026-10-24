import { AccessScreen } from "@/components/access-screen";
import { ArchiveScope } from "@/components/archive-scope";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermArea, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { createArchiveAction } from "@/server/archive/actions";
import { loadArchiveHome } from "@/server/archive/service";

export const dynamic = "force-dynamic";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadArchiveHome();
  if (!page.ok) return <AccessScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="archive" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {page.communityName ? <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p> : null}
      {page.canUpload ? (
        <form action={createArchiveAction} id="archive-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
          <ArchiveScope churches={page.churches} gatherings={page.gatherings} />
          <TermField termKey="field_archive_title" name="title" required />
          <TermField termKey="field_event_date" name="eventDate" type="date" required />
          <TermArea termKey="field_photo_urls" name="photoText" rows={3} />
          <TermArea termKey="field_youtube" name="youtubeText" rows={3} />
          <SubmitButton termKey="save_archive" testId="save-archive" />
        </form>
      ) : null}
      {page.events.length === 0 ? (
        <p className="leading-relaxed">아직 행사자료가 없습니다.</p>
      ) : (
        <ul className="grid list-none gap-3" data-testid="archive-list">
          {page.events.map((event) => (
            <li key={event.id} className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
              <span className="break-words font-semibold" data-testid="archive-title">
                {event.title}
              </span>
              <span className="text-[#5c5148]">{event.eventDate}</span>
              {event.scopeLabel ? (
                <span className="text-[#5c5148]" data-testid="archive-place">
                  {event.scopeLabel}
                </span>
              ) : null}
              {event.materials.length === 0 ? null : (
                <ul className="grid list-none gap-1">
                  {event.materials.map((material) => (
                    <li key={material}>
                      <a className="break-all underline" href={material} rel="noreferrer" target="_blank">
                        {material}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
