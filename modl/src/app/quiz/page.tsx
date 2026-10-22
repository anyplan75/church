import Link from "next/link";
import { AccessScreen } from "@/components/access-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { SubmitButton, TermArea, TermField } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { createQuizAction, saveQuizPrizeAction } from "@/server/archive/actions";
import { loadQuizHome } from "@/server/archive/service";

export const dynamic = "force-dynamic";

export default async function QuizListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadQuizHome();
  if (!page.ok) return <AccessScreen />;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="quiz" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
      {page.king ? (
        <p className="leading-relaxed" data-testid="quiz-king">
          이번 달 퀴즈왕 {page.king.name}. 맞힌 수 {page.king.correct}.
          {page.king.prizeName ? ` 상품 ${page.king.prizeName}.` : ""}
        </p>
      ) : null}
      {!page.king && page.prizeName ? <p className="leading-relaxed">상품 {page.prizeName}.</p> : null}
      {page.canCreate ? (
        <>
          <form action={createQuizAction} id="quiz-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <TermField termKey="field_quiz_title" name="title" required />
            <p className="leading-relaxed text-[#5c5148]">
              <TermText termKey="quiz_line_help" />
            </p>
            <TermArea termKey="field_quiz_lines" name="lines" required rows={5} />
            <TermField termKey="field_worship_ended" name="worshipEndedAt" type="datetime-local" required />
            <TermField termKey="field_solve_minutes" name="solveMinutes" type="number" required />
            <SubmitButton termKey="save_quiz" testId="save-quiz" />
          </form>
          <form action={saveQuizPrizeAction} className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <TermField termKey="field_prize_name" name="prizeName" required />
            <SubmitButton termKey="save_prize" />
          </form>
        </>
      ) : null}
      {page.quizzes.length === 0 ? (
        <p className="leading-relaxed">
          <TermText termKey="quiz_empty" />
        </p>
      ) : (
        <ul className="grid list-none gap-2" data-testid="quiz-list">
          {page.quizzes.map((quiz) => (
            <li key={quiz.id} className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
              <Link href={`/quiz/${quiz.id}`} className="break-words font-semibold" data-testid="quiz-title">
                {quiz.title}
              </Link>
              <span className="text-[#5c5148]">{quiz.open ? "지금은 풀 수 있습니다." : "지금은 풀 수 없습니다."}</span>
              {quiz.myScore ? (
                <span>
                  맞힌 수 {quiz.myScore.score}/{quiz.myScore.total}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
