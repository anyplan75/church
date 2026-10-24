import { AccessScreen } from "@/components/access-screen";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { loadSurveyResults } from "@/server/survey/service";

export const dynamic = "force-dynamic";

export default async function SurveyResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await loadSurveyResults(id);
  if (!page.ok) return <AccessScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="survey_results" level={1} />
        <>
          <h2 className="break-words text-[clamp(1.25rem,1rem+0.8vw,1.8rem)] font-semibold leading-snug">{page.survey.title}</h2>
          <p className="leading-relaxed">
            <TermText termKey="survey_results_rule" />
          </p>
          {page.responses.length === 0 ? (
            <p className="leading-relaxed">
              <TermText termKey="survey_empty" />
            </p>
          ) : (
            <ul className="grid gap-3">
              {page.responses.map((response) => (
                <li key={response.id} data-testid="survey-response" className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
                  {response.authorName ? (
                    <span className="break-words font-semibold">{response.authorName}</span>
                  ) : (
                    <TermText termKey="anonymous_author" />
                  )}
                  {response.answers.map((answer, index) => (
                    <p key={`${response.id}-${index}`} className="break-words">
                      <TermText termKey="survey_answer_label" /> {index + 1}. {answer}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </>
    </section>
  );
}
