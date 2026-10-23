import Link from "next/link";
import { notFound } from "next/navigation";
import { InstagramFeed } from "@/components/instagram-feed";
import { PromoBoard } from "@/components/promo-board";
import { YoutubeMagazine } from "@/components/youtube-magazine";
import { instagramHref } from "@/promo/rules";
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
  const instagram = instagramHref(page.content.instagram);
  const instagramFeed = await loadInstagramFeed(page.content.instagram);
  const youtubeFeed = await loadYoutubeFeed(page.content.youtube);

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
      <section
        className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4"
        data-testid="instagram-section"
        data-instagram-feed={instagramFeed.status}
        data-instagram-reason={instagramFeed.status === "unavailable" ? instagramFeed.reason : undefined}
      >
        <h2 className="font-semibold">인스타그램</h2>
        {page.content.instagram ? (
          instagram ? (
            <a href={instagram} className="w-fit font-semibold underline" rel="noreferrer" target="_blank">
              {page.content.instagram}
            </a>
          ) : (
            <p className="leading-relaxed">{page.content.instagram}</p>
          )
        ) : (
          <p className="leading-relaxed text-[#5c5148]">인스타그램 계정이 없습니다.</p>
        )}
        {instagramFeed.status === "ready" ? <InstagramFeed posts={instagramFeed.posts} /> : null}
      </section>
      <section
        className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4"
        data-testid="youtube-section"
        data-youtube-feed={youtubeFeed.status}
        data-youtube-reason={youtubeFeed.status === "unavailable" ? youtubeFeed.reason : undefined}
      >
        <h2 className="font-semibold">유튜브</h2>
        {youtubeFeed.status === "ready" ? (
          <YoutubeMagazine videos={youtubeFeed.videos} />
        ) : youtubeFeed.status === "hidden" ? (
          <p className="leading-relaxed text-[#5c5148]">유튜브 글이 없습니다.</p>
        ) : null}
      </section>
      <section className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="font-semibold">게시판</h2>
        <PromoBoard tabs={page.content.tabs} />
      </section>
    </section>
  );
}
