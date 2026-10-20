import { ErrorNote } from "@/components/form-note";
import { answerQuestionAction, approveQuestionReplyAction } from "@/server/questions/actions";
import { loadQuestionDetail } from "@/server/questions/service";
import { AUDIENCE_LABEL } from "@/questions/rules";

export const dynamic = "force-dynamic";

const NOTE = {
  asked: "질문을 남겼습니다.",
  replied: "답글을 남겼습니다. 승인 후에 질문한 사람에게 보입니다.",
  reply_approved: "답글을 승인했습니다.",
} as const;

export default async function QuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = await loadQuestionDetail(id);
  const note = query.ok && query.ok in NOTE ? NOTE[query.ok as keyof typeof NOTE] : "";

  return (
    <section className="grid gap-4">
      <ErrorNote message={query.error} />
      {note ? (
        <p role="status" className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed">
          {note}
        </p>
      ) : null}
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <article className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
            <h1 className="whitespace-pre-wrap break-words text-[clamp(1.25rem,1.05rem+0.5vw,1.6rem)] font-semibold leading-snug">
              {page.question.body}
            </h1>
            <p className="flex flex-wrap gap-2 leading-snug text-[#4b5563]">
              <span className="rounded-full bg-[#f3f4f6] px-3 py-1">{AUDIENCE_LABEL[page.question.audience]}</span>
              {page.question.pastorName ? <span className="rounded-full bg-[#f3f4f6] px-3 py-1">{page.question.pastorName}</span> : null}
            </p>
            {page.question.askerWaiting ? <p className="leading-relaxed">답을 확인하고 있습니다.</p> : null}
          </article>
          {page.replies.map((reply) => (
            <article key={reply.id} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <p className="font-semibold leading-snug">{reply.authorName}</p>
              <p className="whitespace-pre-wrap break-words leading-relaxed">{reply.body}</p>
              <p className="leading-snug text-[#4b5563]">{reply.approved ? "승인됨" : "승인 전"}</p>
              {reply.canApprove ? (
                <form action={approveQuestionReplyAction}>
                  <input type="hidden" name="replyId" value={reply.id} />
                  <input type="hidden" name="returnTo" value={`/question/${page.question.id}`} />
                  <button type="submit" className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
                    답글 승인
                  </button>
                </form>
              ) : null}
            </article>
          ))}
          {page.question.canAnswer ? (
            <form action={answerQuestionAction} className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <input type="hidden" name="questionId" value={page.question.id} />
              <label className="grid gap-1">
                <span className="font-semibold">답글</span>
                <textarea
                  name="body"
                  required
                  rows={5}
                  className="w-full rounded-xl border border-[#e5e7eb] px-3 py-2 leading-relaxed"
                />
              </label>
              <p className="leading-relaxed text-[#4b5563]">승인 전에는 질문한 사람에게 보이지 않습니다.</p>
              <button type="submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
                답글 남기기
              </button>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
