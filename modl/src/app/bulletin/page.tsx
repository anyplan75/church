import Link from "next/link";
import { AccessScreen } from "@/components/access-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { loadBulletinList } from "@/server/bulletin/service";
import { pendingGuideCount } from "@/server/guide/inbox";

export const dynamic = "force-dynamic";

export default async function BulletinListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadBulletinList();
  if (!page.ok) return <AccessScreen />;
  const waiting = await pendingGuideCount();

  return (
    <section className="grid gap-4">
      <TermHeading termKey="bulletin" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {query.ok === "week" ? (
        <p role="status" className="rounded-2xl bg-[#e7f3ec] px-4 py-3 leading-relaxed">
          이번 주 예배를 함께 저장했습니다.
        </p>
      ) : null}
          <p className="leading-relaxed text-[#5c5148]">속한 교회와 모들의 안내입니다.</p>
          {waiting > 0 ? (
            <Link href="/guide-inbox" className="w-fit font-semibold underline">
              메일로 온 안내 {waiting}건이 승인을 기다립니다.
            </Link>
          ) : null}
          <TermHeading termKey="bulletin_archive" level={2} />
          {page.bulletins.length === 0 ? (
            <p className="leading-relaxed">아직 볼 수 있는 안내가 없습니다.</p>
          ) : (
            <ul className="grid gap-2">
              {page.bulletins.map((bulletin) => (
                <li key={bulletin.id}>
                  <Link
                    href={`/bulletin/${bulletin.id}`}
                    data-testid="bulletin-link"
                    className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug"
                  >
                    <span className="text-[#5c5148]">
                      {[bulletin.placeLabel, bulletin.worshipDate, bulletin.serviceLabel, bulletin.serviceTime].filter(Boolean).join(" · ")}
                    </span>
                    <span className="break-words font-semibold" data-testid="bulletin-title">
                      {bulletin.sermonTitle || bulletin.serviceLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
    </section>
  );
}
