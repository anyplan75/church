import Link from "next/link";
import { notFound } from "next/navigation";
import type { BoardPlaceKind } from "@/board/rules";
import { deletePlaceBoardPostAction, updatePlaceBoardPostAction } from "@/server/board/actions";
import { loadPlaceBoardPost } from "@/server/board/service";

export const dynamic = "force-dynamic";

function kindOf(value: string): BoardPlaceKind | null {
  if (value === "church" || value === "gathering") return value;
  return null;
}

const FIELD = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

export default async function BoardPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string; postId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { kind: kindText, id, postId } = await params;
  const kind = kindOf(kindText);
  if (!kind) notFound();
  const post = await loadPlaceBoardPost(kind, id, postId);
  if (!post) notFound();
  const query = await searchParams;

  return (
    <section className="grid gap-4" data-testid="board-post-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold leading-snug" style={{ fontFamily: '"JejuMyeongjo", "제주명조", serif' }}>
          {post.title}
        </h1>
        <Link href={`/promo/${kind}/${id}`} className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
          글 목록
        </Link>
      </div>
      {query.error ? <p className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">{query.error}</p> : null}
      {query.ok === "saved" ? <p className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed">글을 고쳤습니다.</p> : null}
      <p className="text-sm leading-snug text-[#5c5148]">
        {post.placeName} · {post.authorName} · {post.createdLabel}
      </p>
      <p className="whitespace-pre-wrap leading-relaxed" data-testid="board-post-body">
        {post.body}
      </p>
      {post.mine ? (
        <form action={updatePlaceBoardPostAction} className="grid gap-3" data-testid="board-edit-form">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="placeId" value={id} />
          <input type="hidden" name="postId" value={post.id} />
          <label className="grid gap-1">
            <span className="font-semibold">제목 고치기</span>
            <input name="title" required maxLength={80} defaultValue={post.title} className={FIELD} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">내용 고치기</span>
            <textarea name="body" required rows={8} maxLength={2000} defaultValue={post.body} className={`${FIELD} leading-relaxed`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
              고친 글 저장
            </button>
          </div>
        </form>
      ) : null}
      {post.mine ? (
        <form action={deletePlaceBoardPostAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="placeId" value={id} />
          <input type="hidden" name="postId" value={post.id} />
          <button type="submit" data-testid="board-delete" className="rounded-xl border border-[#e4d8c8] bg-white px-4 py-3 font-semibold">
            이 글 지우기
          </button>
        </form>
      ) : null}
    </section>
  );
}
