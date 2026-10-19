import Link from "next/link";
import { ErrorNote, OkNote } from "@/components/form-note";
import { TermHeading } from "@/components/term-heading";
import { TermText } from "@/components/term-text";
import { loadBulletinList } from "@/server/bulletin/service";

export const dynamic = "force-dynamic";

export default async function BulletinListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const query = await searchParams;
  const page = await loadBulletinList();

  return (
    <section className="grid gap-4">
      <TermHeading termKey="bulletin" level={1} />
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="leading-relaxed text-[#5c5148]">{page.communityName}</p>
          {page.canPublish ? (
            <Link
              href="/bulletin/new"
              className="inline-flex w-fit max-w-full rounded-2xl bg-[#1d6b45] px-4 py-3 font-semibold leading-snug text-white"
            >
              <TermText termKey="bulletin_new" />
            </Link>
          ) : (
            <p className="leading-relaxed text-[#5c5148]">발행된 주보만 볼 수 있습니다. 만들거나 고치는 일은 사역자와 임원만 합니다.</p>
          )}
          <TermHeading termKey="bulletin_archive" level={2} />
          {page.bulletins.length === 0 ? (
            <p className="leading-relaxed">아직 볼 수 있는 주보가 없습니다.</p>
          ) : (
            <ul className="grid gap-2">
              {page.bulletins.map((bulletin) => (
                <li key={bulletin.id}>
                  <Link
                    href={`/bulletin/${bulletin.id}`}
                    data-testid="bulletin-link"
                    className="grid gap-1 rounded-2xl bg-[#fffaf3] px-4 py-3 leading-snug"
                  >
                    <span className="text-[#5c5148]">{bulletin.worshipDate}</span>
                    <span className="break-words font-semibold" data-testid="bulletin-title">
                      {bulletin.sermonTitle}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
