import { ErrorNote } from "@/components/form-note";
import { QuestionComposer, QuestionList } from "@/components/question-board";
import { loadQuestionHome } from "@/server/questions/service";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const home = await loadQuestionHome();

  return (
    <section className="grid gap-4">
      <ErrorNote message={query.error} />
      <QuestionComposer canAsk={home.canAsk} pastors={home.pastors} />
      <QuestionList questions={home.questions} />
    </section>
  );
}
