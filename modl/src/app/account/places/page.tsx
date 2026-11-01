import Link from "next/link";
import { showsSiteOperator } from "@/account/access";
import { AccessScreen } from "@/components/access-screen";
import { ErrorNote } from "@/components/form-note";
import { OperatorPlaces } from "@/components/operator-places";
import { loadAccountPage } from "@/server/community/service";
import { loadChurchSettings } from "@/server/map/board";
import { loadGatheringSettings } from "@/server/place/service";

export const dynamic = "force-dynamic";

function note(ok: string | undefined, count: string | undefined, missed: string | undefined): string {
  if (ok === "church") return "교회를 저장했습니다.";
  if (ok === "removed") return "교회를 지웠습니다.";
  if (ok === "missed") return "교회는 저장했지만, 주소를 지도에서 찾지 못해 핀은 없습니다.";
  if (ok === "gathering-saved") return "모들 이름과 주소를 저장했습니다.";
  if (ok === "sheet") {
    const saved = count && /^\d+$/.test(count) ? `${count}곳을 넣었습니다.` : "엑셀의 교회를 넣었습니다.";
    if (missed && /^\d+$/.test(missed) && missed !== "0") return `${saved} ${missed}곳은 주소를 찾지 못해 핀이 없습니다.`;
    return saved;
  }
  return "";
}

export default async function OperatorPlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; count?: string; missed?: string }>;
}) {
  const query = await searchParams;
  const account = await loadAccountPage();
  if (!account.user || !showsSiteOperator(account.role)) return <AccessScreen />;
  const churches = await loadChurchSettings();
  const gatherings = await loadGatheringSettings();
  const status = note(query.ok, query.count, query.missed);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title text-[clamp(1.45rem,1.1rem+0.85vw,2rem)] leading-tight">교회와 모들 전체 수정</h1>
        <Link href="/account?tab=site" className="rounded-2xl bg-[#fffaf3] px-3 py-2 leading-snug">
          사이트운영자
        </Link>
      </div>
      <ErrorNote message={query.error} />
      {status ? (
        <p role="status" className="rounded-2xl bg-[#ecfdf3] px-4 py-3 leading-relaxed">
          {status}
        </p>
      ) : null}
      {!churches.ok ? <p className="leading-relaxed">{churches.message}</p> : null}
      {!gatherings.ok ? <p className="leading-relaxed">{gatherings.message}</p> : null}
      {churches.ok && gatherings.ok ? <OperatorPlaces churches={churches.churches} gatherings={gatherings.gatherings} /> : null}
    </section>
  );
}
