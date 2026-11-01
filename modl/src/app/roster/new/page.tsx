import { AccessScreen } from "@/components/access-screen";
import { ErrorNote } from "@/components/form-note";
import { RosterForm } from "@/components/roster-form";
import { TermHeading } from "@/components/term-heading";
import { createRosterAction } from "@/server/community/actions";
import { loadRosterPage } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function NewRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const page = await loadRosterPage();
  if (!page.ok) return <AccessScreen />;

  return (
    <section className="grid gap-4">
      <TermHeading termKey="add_roster" level={1} />
      <p className="leading-relaxed text-[#5c5148]">
        계정 없이 이름만 적으면 미가입 명부가 됩니다. 나중에 같은 전화번호로 가입이 승인되면 이 줄에 계정이 붙습니다.
      </p>
      <ErrorNote message={query.error} />
      <RosterForm action={createRosterAction} groups={page.data.groups} submitKey="add_roster" />
    </section>
  );
}
