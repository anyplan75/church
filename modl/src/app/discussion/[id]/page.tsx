import Link from "next/link";
import { ErrorNote } from "@/components/form-note";
import { LoginGuide } from "@/components/login-guide";
import { TermHeading } from "@/components/term-heading";
import { createDiscussionReplyAction } from "@/server/discussion/actions";
import { loadDiscussionPost } from "@/server/discussion/service";

export const dynamic = "force-dynamic";

function writtenAt(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function DiscussionPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = await loadDiscussionPost(id);

  return (
    <section className="grid min-w-0 gap-4" data-testid="discussion-thread">
      <TermHeading termKey="discussion" level={1} />
      <Link href="/discussion" className="w-fit rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
        글 목록
      </Link>
      <ErrorNote message={query.error} />
      {query.ok === "post" ? (
        <p role="status" className="rounded-2xl bg-[#e7f3ec] px-4 py-3 leading-relaxed">
          글을 올렸습니다.
        </p>
      ) : null}
      {query.ok === "reply" ? (
        <p role="status" className="rounded-2xl bg-[#e7f3ec] px-4 py-3 leading-relaxed">
          답글을 달았습니다.
        </p>
      ) : null}
      {!page.ok && page.reason === "guest" ? <LoginGuide compact /> : null}
      {!page.ok && page.reason === "hidden" ? (
        <p className="leading-relaxed">이 글은 지금 예배드리는 교회나 지금 가는 모들에 속한 사람만 봅니다.</p>
      ) : null}
      {page.ok ? (
        <>
          <article data-testid="discussion-post" className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4">
            <h2 className="break-words text-lg font-semibold leading-snug" data-testid="discussion-title">
              {page.post.title}
            </h2>
            <p className="break-words leading-relaxed" data-testid="discussion-body">
              {page.post.body}
            </p>
            <p className="text-sm leading-snug text-[#5c5148]">
              {page.post.placeLabel} · {page.post.authorName} · {writtenAt(page.post.createdAt)}
            </p>
          </article>
          {page.replies.length === 0 ? (
            <p className="leading-relaxed" data-testid="discussion-replies-empty">
              아직 답글이 없습니다.
            </p>
          ) : (
            <ul className="grid list-none gap-2" data-testid="discussion-replies">
              {page.replies.map((reply) => (
                <li key={reply.id} data-testid="discussion-reply" className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3">
                  <p className="font-semibold">{reply.authorName}</p>
                  <p className="break-words leading-relaxed" data-testid="discussion-reply-body">
                    {reply.body}
                  </p>
                  <p className="text-sm leading-snug text-[#5c5148]">{writtenAt(reply.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <form action={createDiscussionReplyAction} id="discussion-reply-form" data-testid="discussion-reply-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
            <input type="hidden" name="postId" value={page.post.id} />
            <label className="grid gap-1">
              <span className="font-semibold">답글</span>
              <textarea
                name="body"
                required
                rows={4}
                maxLength={4000}
                data-testid="discussion-reply-input"
                className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-relaxed"
              />
            </label>
            <button type="submit" data-testid="discussion-reply-submit" className="w-fit rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
              답글 올리기
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}
