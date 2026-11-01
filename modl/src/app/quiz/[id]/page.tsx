import { BlockedScreen } from "@/components/blocked-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
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
  if (!page.ok) return <BlockedScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="quiz" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <h2 className="break-words text-[clamp(1.3rem,1.1rem+0.6vw,1.8rem)] font-semibold leading-snug" data-testid="quiz-title">
        {page.quiz.title}
      </h2>
      {page.quiz.myScore ? (
        <p data-testid="quiz-score" className="leading-relaxed">
          맞힌 수 {page.quiz.myScore.score}/{page.quiz.myScore.total}
        </p>
      ) : null}
      {!page.quiz.open ? <p className="leading-relaxed">지금은 퀴즈를 풀 수 없습니다.</p> : null}
      {page.quiz.questions.length === 0 ? null : page.quiz.open ? (
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
              {page.quiz.pastor && "answerIndex" in question && typeof question.answerIndex === "number" ? (
                <p className="text-[#5c5148]">정답 {question.answerIndex + 1}</p>
              ) : null}
            </fieldset>
          ))}
          <SubmitButton termKey="submit_quiz" testId="submit-quiz" />
        </form>
      ) : page.quiz.pastor ? (
        <ul className="grid list-none gap-3">
          {page.quiz.questions.map((question, index) => (
            <li key={`${question.prompt}-${index}`} className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3">
              <p className="break-words font-semibold">{question.prompt}</p>
              {"answerIndex" in question && typeof question.answerIndex === "number" ? (
                <p className="text-[#5c5148]">정답 {question.answerIndex + 1}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
