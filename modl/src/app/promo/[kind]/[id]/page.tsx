import Link from "next/link";
import { notFound } from "next/navigation";
import { PromoBoard } from "@/components/promo-board";
import { instagramHref } from "@/promo/rules";
import { loadPromo, type PromoKind } from "@/server/promo/service";

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
      <section className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4">
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
      </section>
      <section className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="font-semibold">유튜브</h2>
        {page.content.youtube.length === 0 ? (
          <p className="leading-relaxed text-[#5c5148]">유튜브 글이 없습니다.</p>
        ) : (
          <ul className="grid list-none gap-2">
            {page.content.youtube.map((item) => (
              <li key={item.url}>
                <a href={item.url} className="font-semibold underline" rel="noreferrer" target="_blank">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="font-semibold">게시판</h2>
        <PromoBoard tabs={page.content.tabs} />
      </section>
    </section>
  );
}
