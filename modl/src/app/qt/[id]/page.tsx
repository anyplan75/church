import { ActionToast } from "@/components/action-toast";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermButton } from "@/components/term-button";
import { TermArea } from "@/components/term-field";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { giveGraceAction, saveReflectionAction } from "@/server/qt/actions";
import { loadQtDetail } from "@/server/qt/service";

export const dynamic = "force-dynamic";

function ReflectionCard({
  qtId,
  card,
  testId,
}: {
  qtId: string;
  card: {
    id: string;
    memberName: string;
    answers: string[];
    graceCount: number;
    isMine: boolean;
  };
  testId: string;
}) {
  const formId = `grace-${card.id}`;
  return (
    <article data-testid={testId} className="grid min-w-0 gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3">
      <p className="break-words font-semibold">{card.memberName}</p>
      {card.answers.map((answer) => (
        <p key={answer} className="break-words leading-relaxed" data-testid={card.isMine ? "my-reflection" : "notice-answer"}>
          {answer}
        </p>
      ))}
      <p className="leading-snug" data-testid="grace-count">
        {card.graceCount}
      </p>
      <form id={formId} action={giveGraceAction}>
        <input type="hidden" name="qtId" value={qtId} />
        <input type="hidden" name="reflectionId" value={card.id} />
      </form>
      <TermButton termKey="grace_reaction_btn" testId="grace-reaction-btn" toastOnPress={false} submitFormId={formId} />
    </article>
  );
}

export default async function QtDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string; ocr?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = await loadQtDetail(id);

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="qt" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {query.ocr === "1" ? <OkNote code="ocr" /> : null}
      {query.ok === "reflection" ? <ActionToast termKey="submit_qt_btn" testId="reflection-toast" /> : null}
      {query.ok === "grace" ? <ActionToast termKey="grace_reaction_btn" testId="grace-toast" /> : null}
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="text-[#5c5148]">{page.qt.qtDate}</p>
          <h2 className="break-words text-[clamp(1.3rem,1.1rem+0.6vw,1.8rem)] font-semibold leading-snug" data-testid="qt-title">
            {page.qt.scriptureTitle}
          </h2>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{page.qt.scriptureBody}</p>
          {page.qt.sourceFileUrl ? (
            <a className="break-all leading-snug text-[#1d6b45]" href={page.qt.sourceFileUrl}>
              {page.qt.sourceFileUrl}
            </a>
          ) : null}
          <ol className="grid list-decimal gap-1 pl-5 leading-relaxed">
            {page.qt.questions.map((question) => (
              <li key={question} className="break-words">
                {question}
              </li>
            ))}
          </ol>
          <form id="reflection-form" action={saveReflectionAction} className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <input type="hidden" name="qtId" value={page.qt.id} />
            <TermArea termKey="field_answers" name="answersText" required rows={5} defaultValue={page.own?.answers.join("\n") ?? ""} />
            <TermButton termKey="submit_qt_btn" testId="submit-qt-btn" toastOnPress={false} submitFormId="reflection-form" />
          </form>
          {page.own ? <ReflectionCard qtId={page.qt.id} card={page.own} testId="own-reflection" /> : null}
          <div className="grid gap-2">
            <TermHeading termKey="reflection_notice" level={2} />
            {page.notices.length === 0 ? (
              <p className="leading-relaxed">
                <TermText termKey="notice_empty" />
              </p>
            ) : (
              page.notices.map((notice) => (
                <ReflectionCard key={notice.id} qtId={page.qt.id} card={notice} testId="reflection-notice" />
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
