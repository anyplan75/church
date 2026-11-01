import Link from "next/link";
import { notFound } from "next/navigation";
import type { BoardPlaceKind } from "@/board/rules";
import { createPlaceBoardPostAction } from "@/server/board/actions";
import { loadPlaceBoard } from "@/server/board/service";
import { loadPromo } from "@/server/promo/service";

export const dynamic = "force-dynamic";

function kindOf(value: string): BoardPlaceKind | null {
  if (value === "church" || value === "gathering") return value;
  return null;
}

const FIELD = "w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug";

export default async function BoardWritePage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { kind: kindText, id } = await params;
  const kind = kindOf(kindText);
  if (!kind) notFound();
  const page = await loadPromo(kind, id);
  const board = await loadPlaceBoard(kind, id);
  if (!page || !board) notFound();
  const query = await searchParams;
  const placeWord = kind === "church" ? "교회" : "모들";

  return (
    <section className="grid gap-4" data-testid="board-write-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold leading-snug" style={{ fontFamily: '"JejuMyeongjo", "제주명조", serif' }}>
          {page.name} 글쓰기
        </h1>
        <Link href={`/promo/${kind}/${id}`} className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
          글 목록
        </Link>
      </div>
      {query.error ? <p className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">{query.error}</p> : null}
      {board.viewer === "guest" ? <p className="leading-relaxed">먼저 들어간 뒤, 이 {placeWord} 구성원이 글을 씁니다.</p> : null}
      {board.viewer === "other" ? <p className="leading-relaxed">이 {placeWord} 구성원만 글을 쓸 수 있습니다.</p> : null}
      {board.canWrite ? (
        <form action={createPlaceBoardPostAction} className="grid gap-3" data-testid="board-write-form">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="placeId" value={id} />
          <p className="leading-relaxed text-[#5c5148]">이 {placeWord} 구성원이 글을 올립니다. 안내 승인과는 따로입니다.</p>
          <label className="grid gap-1">
            <span className="font-semibold">제목</span>
            <input name="title" required maxLength={80} data-testid="board-title" className={FIELD} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">내용</span>
            <textarea name="body" required rows={8} maxLength={2000} data-testid="board-body" className={`${FIELD} leading-relaxed`} />
          </label>
          <button type="submit" data-testid="board-submit" className="w-fit rounded-xl bg-[#111827] px-4 py-3 font-semibold text-white">
            글 올리기
          </button>
        </form>
      ) : null}
    </section>
  );
}
