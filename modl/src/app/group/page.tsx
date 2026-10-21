import { BlockedScreen } from "@/components/blocked-screen";
import { ErrorNote, OkNote } from "@/components/form-note";
import { GroupWork, seasonYear } from "@/components/account-work";
import { TermHeading } from "@/components/term-heading";
import { loadGroupPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; year?: string }>;
}) {
  const query = await searchParams;
  const page = await loadGroupPage();
  if (!page.ok) return <BlockedScreen />;
  const year = seasonYear(query.year);

  return (
    <section className="grid gap-6">
      <TermHeading termKey="group" level={1} />
      <p className="leading-relaxed text-[#5c5148]">해가 바뀌면 이전 모들은 보관만 하고 지우지 않습니다. 지난 편성과 연결 기록도 그대로 남습니다.</p>
      <ErrorNote message={query.error} />
      <OkNote code={query.ok} />
      <GroupWork year={year} scope="page" />
    </section>
  );
}
