import Link from "next/link";
import { notFound } from "next/navigation";
import { PromoBoard } from "@/components/promo-board";
import { PromoSnsLazy } from "@/components/promo-sns-lazy";
import { loadPromo, type PromoKind } from "@/server/promo/service";

/** 공개 홍보 페이지는 짧은 시간 동안 기억해 두어도 됩니다. 계정·설정 화면은 dynamic을 유지합니다. */
export const revalidate = 60;

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
      <PromoSnsLazy kind={kind} id={id} instagramAccount={page.content.instagram} />
      <section className="grid gap-2 rounded-3xl bg-[#fffaf3] p-4">
        <h2 className="font-semibold">게시판</h2>
        <PromoBoard tabs={page.content.tabs} />
      </section>
    </section>
  );
}
