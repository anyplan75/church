import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceBoard } from "@/components/place-board";
import { PromoSns } from "@/components/promo-sns";
import { loadPlaceBoard } from "@/server/board/service";
import { loadInstagramFeed } from "@/server/promo/instagram-feed";
import { loadPromo, type PromoKind } from "@/server/promo/service";
import { loadYoutubeFeed } from "@/server/promo/youtube-feed";

export const dynamic = "force-dynamic";

function kindOf(value: string): PromoKind | null {
  if (value === "church" || value === "gathering") return value;
  return null;
}

export default async function PromoPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { kind: kindText, id } = await params;
  const kind = kindOf(kindText);
  if (!kind) notFound();
  const page = await loadPromo(kind, id);
  if (!page) notFound();
  const query = await searchParams;
  const instagramFeed = await loadInstagramFeed(page.content.instagram);
  const youtubeFeed = await loadYoutubeFeed(page.content.youtube);
  const board = await loadPlaceBoard(kind, id);
  if (!board) notFound();

  return (
    <section className="grid gap-4" data-testid="promo-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold leading-snug" style={{ fontFamily: '"JejuMyeongjo", "제주명조", serif' }}>
          {page.name}
        </h1>
        {page.manager ? (
          <Link href={`/promo/${kind}/${id}/settings`} data-testid="promo-settings" className="rounded-xl bg-[#111827] px-3 py-2 font-semibold text-white">
            설정
          </Link>
        ) : null}
      </div>
      {query.ok === "saved" ? <p className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">홍보 페이지를 저장했습니다.</p> : null}
      {query.ok === "board-deleted" ? <p className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">글을 지웠습니다.</p> : null}
      <PromoSns
        headingLevel="h2"
        instagramAccount={page.content.instagram}
        instagram={instagramFeed}
        youtube={youtubeFeed}
      />
      <section className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="font-semibold">게시판</h2>
        <PlaceBoard kind={kind} id={id} canWrite={board.canWrite} posts={board.posts} />
      </section>
    </section>
  );
}
