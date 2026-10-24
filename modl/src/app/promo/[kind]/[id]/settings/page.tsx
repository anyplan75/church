import Link from "next/link";
import { notFound } from "next/navigation";
import { BulletinEditor } from "@/components/bulletin-editor";
import { PromoSettingsForm } from "@/components/promo-settings-form";
import { saveBulletinAction } from "@/server/bulletin/actions";
import { canMakeGuide } from "@/server/bulletin/service";
import { loadPromo, type PromoKind } from "@/server/promo/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const guide = await canMakeGuide(kind, id);
  const query = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

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
      ) : guide ? null : (
        <p className="leading-relaxed">설정은 이 관리자에게만 보입니다.</p>
      )}
      {guide ? (
        <section data-testid="guide-settings" className="grid gap-3 rounded-3xl bg-[#fffaf3] p-4">
          <h2 className="text-xl font-semibold leading-snug">안내 만들기</h2>
          <p className="leading-relaxed text-[#5c5148]">이 {kind === "church" ? "교회" : "모들"}의 안내만 만듭니다. 안내 메뉴에는 만들기 화면을 두지 않습니다.</p>
          <BulletinEditor
            action={saveBulletinAction}
            worshipDate={today}
            sermonTitle=""
            scriptureText=""
            preacher=""
            blocks={[]}
            placeKind={kind}
            placeId={id}
          />
        </section>
      ) : null}
    </section>
  );
}
