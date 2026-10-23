import Link from "next/link";
import { notFound } from "next/navigation";
import { PromoSettingsForm } from "@/components/promo-settings-form";
import { loadPromo, type PromoKind } from "@/server/promo/service";

export const dynamic = "force-dynamic";

function kindOf(value: string): PromoKind | null {
  if (value === "church" || value === "gathering") return value;
  return null;
}

export default async function PromoSettingsPage({
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
  if (!page) notFound();
  const query = await searchParams;

  return (
    <section className="grid gap-4" data-testid="promo-settings-page">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold leading-snug" style={{ fontFamily: '"JejuMyeongjo", "제주명조", serif' }}>
          {page.name} 홍보
        </h1>
        <Link href={`/promo/${kind}/${id}`} className="rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 font-semibold">
          홍보 페이지
        </Link>
      </div>
      {page.manager ? (
        <>
          {query.error ? <p className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">{query.error}</p> : null}
          <p className="leading-relaxed text-[#5c5148]">인스타그램 계정, 유튜브 글, 게시판만 만듭니다.</p>
          <PromoSettingsForm kind={kind} id={id} content={page.content} />
        </>
      ) : (
        <p className="leading-relaxed">설정은 이 관리자에게만 보입니다.</p>
      )}
    </section>
  );
}
