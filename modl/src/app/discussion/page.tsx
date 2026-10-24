import Link from "next/link";
import { choiceButtonClass, choiceButtonStyle, choiceRowClass, choiceToneColor, type ChoiceTone } from "@/components/choice-buttons";
import { ErrorNote } from "@/components/form-note";
import { LoginGuide } from "@/components/login-guide";
import { TermHeading } from "@/components/term-heading";
import { isBroadDiscussionScope } from "@/discussion/rules";
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

function toneOf(kind: string): ChoiceTone {
  if (kind === "church") return "church";
  if (kind === "gathering") return "gathering";
  return "region";
}

export default async function DiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; scope?: string }>;
}) {
  const query = await searchParams;
  const page = await loadDiscussionBoard(query.scope ?? "");

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
          <div data-testid="discussion-scopes" className={choiceRowClass}>
            {page.scopes.map((scope) => {
              const ref = `${scope.kind}:${scope.id}`;
              const on = page.selected?.kind === scope.kind && page.selected.id === scope.id;
              return (
                <Link
                  key={ref}
                  href={`/discussion?scope=${encodeURIComponent(ref)}`}
                  data-testid="discussion-scope"
                  data-kind={scope.kind}
                  data-on={on ? "yes" : "no"}
                  className={choiceButtonClass}
                  style={choiceButtonStyle(on, choiceToneColor(toneOf(scope.kind)))}
                >
                  {scope.label}
                </Link>
              );
            })}
          </div>
          {page.selected ? (
            <form action={createDiscussionPostAction} id="discussion-form" data-testid="discussion-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
              <input type="hidden" name="placeRef" value={`${page.selected.kind}:${page.selected.id}`} data-testid="discussion-place" />
              {isBroadDiscussionScope(page.selected.kind) ? (
                <label className="flex items-center gap-2 leading-snug">
                  <input type="checkbox" name="anonymous" value="1" data-testid="discussion-anonymous" />
                  익명으로 올리기
                </label>
              ) : null}
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
          ) : null}
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
