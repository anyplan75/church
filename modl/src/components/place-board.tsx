import Link from "next/link";
import type { BoardListItem } from "@/server/board/service";
import type { BoardPlaceKind } from "@/board/rules";

/** 교회·모들 게시판 목록입니다. 제목만 나열하고, 글은 눌러서 봅니다. */
export function PlaceBoard({
  kind,
  id,
  canWrite,
  posts,
}: {
  kind: BoardPlaceKind;
  id: string;
  canWrite: boolean;
  posts: readonly BoardListItem[];
}) {
  return (
    <div className="grid gap-3" data-testid="place-board">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="leading-relaxed text-[#5c5148]">
          {canWrite ? "구성원이 글을 올리고, 자기 글은 고치거나 지울 수 있습니다." : "이 교회·모들 구성원만 글을 쓸 수 있습니다."}
        </p>
        {canWrite ? (
          <Link href={`/promo/${kind}/${id}/board/new`} data-testid="board-write" className="rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
            글쓰기
          </Link>
        ) : null}
      </div>
      {posts.length === 0 ? (
        <p className="leading-relaxed">아직 글이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-[#eadfce]" data-testid="board-list">
          {posts.map((post) => (
            <li key={post.id} className="grid gap-1 py-3">
              <Link href={`/promo/${kind}/${id}/board/${post.id}`} className="font-semibold leading-snug" data-testid="board-post">
                {post.title}
              </Link>
              <p className="text-sm leading-snug text-[#5c5148]">
                {post.authorName} · {post.createdLabel}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
