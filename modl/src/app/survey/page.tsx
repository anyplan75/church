import Link from "next/link";
import { SurveyAnonymousField } from "@/components/choice-fields";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermArea, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { createSurveyAction } from "@/server/survey/actions";
import { loadSurveyHome } from "@/server/survey/service";

export const dynamic = "force-dynamic";

export default async function SurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadSurveyHome();

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="survey" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          <p className="leading-relaxed">
            <TermText termKey="survey_results_rule" />
          </p>
          {page.canManage ? (
            <form action={createSurveyAction} id="survey-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <TermField termKey="field_survey_title" name="title" required />
              <TermArea termKey="field_survey_questions" name="questionsText" required rows={4} />
              <SurveyAnonymousField />
              <TermField termKey="field_deadline" name="deadline" type="datetime-local" />
              <SubmitButton termKey="save_survey" testId="save-survey" />
            </form>
          ) : (
            <p className="leading-relaxed">
              <TermText termKey="survey_officers_create" />
            </p>
          )}
          {page.surveys.length === 0 ? (
            <p className="leading-relaxed">
              <TermText termKey="survey_empty" />
            </p>
          ) : (
            <ul className="grid gap-2">
              {page.surveys.map((survey) => (
                <li key={survey.id} className="grid gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                  <Link href={`/survey/${survey.id}`} className="break-words font-semibold" data-testid="survey-title">
                    {survey.title}
                  </Link>
                  {survey.allowAnonymous ? <TermText termKey="allow_anonymous_survey" /> : null}
                  {survey.canSeeResults ? (
                    <Link href={`/survey/${survey.id}/results`} className="w-fit max-w-full font-semibold">
                      <TermText termKey="survey_results" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
