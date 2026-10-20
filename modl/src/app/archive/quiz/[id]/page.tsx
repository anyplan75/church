import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { submitQuizAction } from "@/server/archive/actions";
import { loadQuiz } from "@/server/archive/service";

export const dynamic = "force-dynamic";

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = await loadQuiz(id);

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="archive" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <h2 className="break-words text-[clamp(1.3rem,1.1rem+0.6vw,1.8rem)] font-semibold leading-snug" data-testid="quiz-title">
            {page.quiz.title}
          </h2>
          {page.quiz.myScore ? (
            <p data-testid="quiz-score" className="leading-relaxed">
              <TermText termKey="quiz_score" /> {page.quiz.myScore.score}/{page.quiz.myScore.total}
            </p>
          ) : null}
          <form action={submitQuizAction} id="quiz-answer-form" className="grid gap-4 rounded-3xl bg-[#fffaf3] p-4">
            <input type="hidden" name="quizId" value={page.quiz.id} />
            {page.quiz.questions.map((question, index) => (
              <fieldset key={`${question.prompt}-${index}`} className="grid min-w-0 gap-2">
                <legend className="break-words font-semibold leading-snug">{question.prompt}</legend>
                {question.choices.map((choice, choiceIndex) => (
                  <label key={`${choice}-${choiceIndex}`} className="flex min-w-0 items-start gap-2 leading-snug">
                    <input className="mt-1" type="radio" name={`answer${index}`} value={String(choiceIndex)} required />
                    <span className="break-words">{choice}</span>
                  </label>
                ))}
              </fieldset>
            ))}
            <SubmitButton termKey="submit_quiz" testId="submit-quiz" />
          </form>
        </>
      )}
    </section>
  );
}
