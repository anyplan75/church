import Link from "next/link";
import { ErrorNote } from "@/components/form-note";
import { WorshipLive } from "@/components/worship-live";
import { saveCaptionLinksAction } from "@/server/worship/actions";
import { loadWorshipPage } from "@/server/worship/caption";

export const dynamic = "force-dynamic";

export default async function WorshipPage({
  searchParams,
}: {
  searchParams: Promise<{ church?: string; error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const churchId = query.church?.trim() ?? "";
  if (!churchId) {
    return (
      <section className="grid gap-3">
        <h1 className="page-title text-[clamp(1.6rem,1.2rem+1vw,2rem)] leading-snug">예배</h1>
        <p className="leading-relaxed">출석에서 교회를 선택하라</p>
        <Link href="/attendance?pick=church" className="w-fit rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug">
          출석으로
        </Link>
      </section>
    );
  }
  const page = await loadWorshipPage(churchId);
  if (!page.ok) {
    return (
      <section className="grid gap-3">
        <h1 className="page-title text-[clamp(1.6rem,1.2rem+1vw,2rem)] leading-snug">예배</h1>
        <p className="leading-relaxed">{page.message}</p>
      </section>
    );
  }
  const saved = new Map(page.stored.map((item) => [item.code, item.url]));

  return (
    <section className="grid min-w-0 gap-4">
      <h1 className="page-title text-[clamp(1.6rem,1.2rem+1vw,2rem)] leading-snug">예배</h1>
      <ErrorNote message={query.error} />
      {query.ok === "captions" ? (
        <p role="status" className="rounded-2xl bg-[#e7f3ec] px-4 py-3 leading-relaxed">
          언어와 자막 링크를 저장했습니다.
        </p>
      ) : null}
      {page.canEdit ? (
        <form action={saveCaptionLinksAction} data-testid="worship-caption-form" className="grid gap-3 rounded-3xl bg-[#fffaf3] px-4 py-4">
          <h2 className="text-lg font-semibold leading-snug">자막 언어</h2>
          <p className="leading-relaxed text-[#5c5148]">
            쓸 언어마다 실시간 번역기의 자막 링크를 적습니다. 비운 언어는 예배를 보는 사람이 고를 수 없습니다.
          </p>
          <input type="hidden" name="communityId" value={page.churchId} />
          {page.languages.map((item) => (
            <label key={item.code} className="grid gap-1">
              <span className="font-semibold">{item.label}</span>
              <input
                name={`url-${item.code}`}
                type="url"
                inputMode="url"
                defaultValue={saved.get(item.code) ?? ""}
                placeholder="https://"
                data-testid={`caption-url-${item.code}`}
                className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-6"
              />
            </label>
          ))}
          <button type="submit" className="w-fit rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold leading-snug text-white">
            자막 언어 저장
          </button>
        </form>
      ) : null}
      <WorshipLive churchId={page.churchId} services={page.services} choices={page.choices} />
    </section>
  );
}
