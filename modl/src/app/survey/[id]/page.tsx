import Link from "next/link";
import { AccessScreen } from "@/components/access-screen";
import { ErrorNote, NoteBanner, OkNote } from "@/components/form-note";
import { SubmitButton } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { submitSurveyAction } from "@/server/survey/actions";
import { loadSurveyForm } from "@/server/survey/service";

export const dynamic = "force-dynamic";

const inputClass = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

export default async function SurveyFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string; note?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = await loadSurveyForm(id);
  if (!page.ok) return <AccessScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="survey" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <NoteBanner code={query.note} />
        <>
          <h2 className="break-words text-[clamp(1.25rem,1rem+0.8vw,1.8rem)] font-semibold leading-snug" data-testid="survey-heading">
            {page.survey.title}
          </h2>
          {page.survey.allowAnonymous ? <TermText termKey="allow_anonymous_survey" /> : null}
          {page.canSeeResults ? (
            <Link href={`/survey/${page.survey.id}/results`} className="w-fit max-w-full font-semibold">
              <TermText termKey="survey_results" />
            </Link>
          ) : null}
          {page.survey.open ? (
            <form action={submitSurveyAction} id="answer-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <input type="hidden" name="surveyId" value={page.survey.id} />
              {page.survey.questions.map((question, index) => (
                <label key={`${page.survey.id}-${index}`} className="grid gap-1">
                  <span className="break-words font-semibold">{question}</span>
                  <input className={inputClass} name={`answer${index}`} required data-testid={`survey-answer-${index}`} />
                </label>
              ))}
              <SubmitButton termKey="submit_answer" testId="submit-survey" />
            </form>
          ) : (
            <p className="leading-relaxed">
              <TermText termKey="survey_closed" />
            </p>
          )}
        </>
    </section>
  );
}
