import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { reviewApprovalAction } from "@/server/community/actions";
import { loadApprovalPage } from "@/server/community/service";
import { approveQuestionReplyAction } from "@/server/questions/actions";
import { loadPendingReplies } from "@/server/questions/service";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadApprovalPage();
  const replies = await loadPendingReplies();
  const replyNote = query.ok === "reply_approved" ? "답글을 승인했습니다." : "";
  return (
    <section className="grid gap-4">
      <TermHeading termKey="approval" level={1} />
      <p className="leading-relaxed text-[#5c5148]">승인 대기 중에는 정식 구성원 권한이 없습니다.</p>
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {replyNote ? (
        <p role="status" className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed">
          {replyNote}
        </p>
      ) : null}
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <ul className="grid gap-3">
          {page.data.requests.map((request) => (
            <li key={request.id} className="grid gap-2 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug">
              <span className="font-semibold">{request.applicantName}</span>
              <span>{request.applicantContact}</span>
              <span className="text-[#5c5148]">{request.status}</span>
              {request.status === "PENDING" ? (
                <form action={reviewApprovalAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="requestId" value={request.id} />
                  <button
                    type="submit"
                    name="decision"
                    value="APPROVED"
                    className="rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold text-white"
                  >
                    <TermText termKey="approve_member" />
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="REJECTED"
                    className="rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold"
                  >
                    <TermText termKey="reject_member" />
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <h2 className="text-[clamp(1.2rem,1rem+0.4vw,1.5rem)] font-semibold leading-snug">답글 승인</h2>
      {!replies.ok ? (
        <p className="leading-relaxed">{replies.message}</p>
      ) : replies.replies.length === 0 ? (
        <p className="leading-relaxed text-[#5c5148]">승인할 답글이 없습니다.</p>
      ) : (
        <ul className="grid gap-3">
          {replies.replies.map((reply) => (
            <li key={reply.id} className="grid gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 leading-relaxed">
              <span className="whitespace-pre-wrap break-words font-semibold">{reply.questionBody}</span>
              <span>{reply.authorName}</span>
              <span className="whitespace-pre-wrap break-words">{reply.body}</span>
              <form action={approveQuestionReplyAction}>
                <input type="hidden" name="replyId" value={reply.id} />
                <input type="hidden" name="returnTo" value="/approvals" />
                <button type="submit" className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
                  답글 승인
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
