import Link from "next/link";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermArea, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { createArchiveAction, createQuizAction } from "@/server/archive/actions";
import { loadArchiveHome } from "@/server/archive/service";

export const dynamic = "force-dynamic";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadArchiveHome();

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="archive" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          {page.canManage ? (
            <>
              <form action={createArchiveAction} id="archive-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
                <TermField termKey="field_archive_title" name="title" required />
                <TermArea termKey="field_photo_urls" name="photoText" rows={3} />
                <TermArea termKey="field_youtube" name="youtubeText" rows={3} />
                <SubmitButton termKey="save_archive" testId="save-archive" />
              </form>
              <form action={createQuizAction} id="quiz-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
                <TermField termKey="field_quiz_title" name="title" required />
                <p className="leading-relaxed text-[#5c5148]">
                  <TermText termKey="quiz_line_help" />
                </p>
                <TermArea termKey="field_quiz_lines" name="lines" required rows={5} />
                <SubmitButton termKey="save_quiz" testId="save-quiz" />
              </form>
            </>
          ) : (
            <p className="leading-relaxed text-[#5c5148]">
              <TermText termKey="archive_leaders_only" />
            </p>
          )}
          {page.events.length === 0 ? (
            <p className="leading-relaxed">
              <TermText termKey="archive_empty" />
            </p>
          ) : (
            <ul className="grid gap-2">
              {page.events.map((event) => (
                <li key={event.id}>
                  <Link href={`/archive/${event.id}`} className="block break-words rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug" data-testid="archive-title">
                    {event.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {page.quizzes.length === 0 ? (
            <p className="leading-relaxed">
              <TermText termKey="quiz_empty" />
            </p>
          ) : (
            <ul className="grid gap-2">
              {page.quizzes.map((quiz) => (
                <li key={quiz.id}>
                  <Link href={`/archive/quiz/${quiz.id}`} className="block break-words rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug" data-testid="quiz-title">
                    {quiz.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
