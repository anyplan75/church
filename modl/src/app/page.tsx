import Link from "next/link";
import { ErrorNote } from "@/components/form-note";
import { QuestionComposer, QuestionList } from "@/components/question-board";
import { loadQuestionHome } from "@/server/questions/service";
import { loadOpenSurveyNotices } from "@/server/survey/service";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const home = await loadQuestionHome();
  const notices = await loadOpenSurveyNotices();

  return (
    <section className="grid gap-10 pt-4 md:pt-[8vh]">
      <ErrorNote message={query.error} />
      {notices.length > 0 ? (
        <section aria-label="알림" className="grid gap-2">
          <h2 className="font-semibold leading-snug">알림</h2>
          <ul className="grid list-none gap-2">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link href={`/survey/${notice.id}`} className="font-semibold leading-snug">
                  {notice.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <QuestionComposer canAsk={home.canAsk} signedIn={home.signedIn} pastors={home.pastors} />
      <QuestionList questions={home.questions} />
    </section>
  );
}
