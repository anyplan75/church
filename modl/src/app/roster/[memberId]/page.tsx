import { BlockedScreen } from "@/components/blocked-screen";
import { ErrorNote } from "@/components/form-note";
import { RosterForm } from "@/components/roster-form";
import { TermHeading } from "@/components/term-heading";
import { updateRosterAction } from "@/server/community/actions";
import { loadMemberForEdit } from "@/server/community/service";

export const dynamic = "force-dynamic";

export default async function EditRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { memberId } = await params;
  const query = await searchParams;
  const page = await loadMemberForEdit(memberId);
  if (!page.ok) return <BlockedScreen />;

  return (
    <section className="grid gap-4">
      <TermHeading termKey="save" level={1} />
      <ErrorNote message={query.error} />
      <RosterForm
        action={updateRosterAction}
        groups={page.groups}
        submitKey="save"
        member={{
          id: page.member.id,
          name: page.member.name,
          phone: page.member.phone,
          birthDate: page.member.birthDate,
          gender: page.member.gender,
          role: page.member.role,
          status: page.member.status,
          cohort: page.member.cohort,
          currentGroupId: page.member.currentGroupId,
        }}
      />
    </section>
  );
}
