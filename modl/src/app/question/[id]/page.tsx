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
        <p role="status" className="rounded-xl bg-[#f1f5f9] px-4 py-3 text-sm leading-5 text-[#334155]">
          {note}
        </p>
      ) : null}
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <article className="grid gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-4">
            <h1 className="whitespace-pre-wrap break-words text-[15px] font-medium leading-6 text-[#1e293b]">
              {page.question.body}
            </h1>
            <p className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-medium text-[#475569]">{AUDIENCE_LABEL[page.question.audience]}</span>
              {page.question.pastorName ? <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-medium text-[#475569]">{page.question.pastorName}</span> : null}
            </p>
            {page.question.askerWaiting ? <p className="text-sm leading-5 text-[#64748b]">답을 확인하고 있습니다.</p> : null}
          </article>
          {page.replies.map((reply) => (
            <article key={reply.id} className="grid gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-4">
              <p className="text-sm font-medium text-[#1e293b]">{reply.authorName}</p>
              <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-[#1e293b]">{reply.body}</p>
              <p className="text-sm text-[#64748b]">{reply.approved ? "승인됨" : "승인 전"}</p>
              {reply.canApprove ? (
                <form action={approveQuestionReplyAction}>
                  <input type="hidden" name="replyId" value={reply.id} />
                  <input type="hidden" name="returnTo" value={`/question/${page.question.id}`} />
                  <button type="submit" className="inline-flex h-9 items-center rounded-[10px] bg-[#e2e8f0] px-3 text-sm font-medium text-[#334155]">
                    답글 승인
                  </button>
                </form>
              ) : null}
            </article>
          ))}
          {page.question.canAnswer ? (
            <form action={answerQuestionAction} className="grid gap-3">
              <input type="hidden" name="questionId" value={page.question.id} />
              <div className="relative rounded-2xl border border-[#cbd5e1] bg-white">
                <label className="sr-only" htmlFor="reply-body">
                  답글
                </label>
                <textarea
                  id="reply-body"
                  name="body"
                  required
                  rows={4}
                  placeholder="답글을 적어 주세요"
                  className="min-h-32 w-full resize-none border-0 bg-transparent px-4 pb-14 pt-4 text-base leading-6 outline-none placeholder:text-[#94a3b8]"
                />
                <button
                  type="submit"
                  className="absolute bottom-3 right-3 inline-flex h-9 items-center rounded-[10px] bg-[#e2e8f0] px-3 text-sm font-medium text-[#334155]"
                >
                  답글 남기기
                </button>
              </div>
              <p className="text-sm leading-5 text-[#64748b]">승인 전에는 질문한 사람에게 보이지 않습니다.</p>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
