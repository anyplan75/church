import Link from "next/link";
import { ErrorNote } from "@/components/form-note";
import { LoginGuide } from "@/components/login-guide";
import { TermHeading } from "@/components/term-heading";
import { createDiscussionPostAction } from "@/server/discussion/actions";
import { loadDiscussionBoard } from "@/server/discussion/service";

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

export default async function DiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadDiscussionBoard();

  return (
    <section className="grid min-w-0 gap-4" data-testid="discussion-board">
      <TermHeading termKey="discussion" level={1} />
      <ErrorNote message={query.error} />
      {query.ok === "post" ? (
        <p role="status" className="rounded-2xl bg-[#e7f3ec] px-4 py-3 leading-relaxed">
          글을 올렸습니다.
        </p>
      ) : null}
      {!page.ok ? (
        <LoginGuide compact />
      ) : (
        <>
          {page.places.length === 0 ? (
            <p className="leading-relaxed">지금 예배드릴 교회나 지금 갈 모임을 고르면 글을 보고 쓸 수 있습니다.</p>
          ) : (
            <form action={createDiscussionPostAction} id="discussion-form" data-testid="discussion-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              {page.places.length === 1 ? (
                <input type="hidden" name="placeRef" value={`${page.places[0].kind}:${page.places[0].id}`} />
              ) : (
                <label className="grid gap-1">
                  <span className="font-semibold">올릴 곳</span>
                  <select name="placeRef" required className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug">
                    {page.places.map((place) => (
                      <option key={`${place.kind}:${place.id}`} value={`${place.kind}:${place.id}`}>
                        {place.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="grid gap-1">
                <span className="font-semibold">제목</span>
                <input
                  name="title"
                  required
                  maxLength={160}
                  data-testid="discussion-title-input"
                  className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-semibold">글</span>
                <textarea
                  name="body"
                  required
                  rows={5}
                  maxLength={4000}
                  data-testid="discussion-body-input"
                  className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-relaxed"
                />
              </label>
              <button type="submit" data-testid="discussion-submit" className="w-fit rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
                글 올리기
              </button>
            </form>
          )}
          {page.posts.length === 0 ? (
            <p className="leading-relaxed" data-testid="discussion-empty">
              아직 글이 없습니다.
            </p>
          ) : (
            <ul className="grid list-none gap-2" data-testid="discussion-list">
              {page.posts.map((post) => (
                <li key={post.id} data-testid="discussion-post" className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3">
                  <Link href={`/discussion/${post.id}`} className="break-words font-semibold" data-testid="discussion-title">
                    {post.title}
                  </Link>
                  <p className="break-words leading-relaxed" data-testid="discussion-body">
                    {post.body}
                  </p>
                  <p className="text-sm leading-snug text-[#5c5148]">
                    {post.placeLabel} · {post.authorName} · {writtenAt(post.createdAt)} · 답글 {post.replyCount}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
